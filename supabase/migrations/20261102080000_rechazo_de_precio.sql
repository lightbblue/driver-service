-- Qué pasa cuando el cliente rechaza el precio del mecánico.
-- - Solicitud del SOS: vuelve a "pendiente" para los demás mecánicos. El mecánico rechazado
--   deja de verla y no puede volver a cotizarla.
-- - Solicitud dirigida a un taller (o a un mecánico en ruta): se cancela, sin cobro.

begin;

-- 1. Mecánicos a los que el cliente ya les rechazó el precio
alter table public.solicitudes
  add column if not exists mecanicos_rechazados uuid[] not null default '{}';

comment on column public.solicitudes.mecanicos_rechazados is
  'Mecánicos cuyo precio rechazó el cliente: ya no ven ni pueden tomar esta solicitud.';

-- 2. El mecánico rechazado no la ve en Disponibles
drop policy if exists "solicitudes: pendientes para mecánicos disponibles" on public.solicitudes;
create policy "solicitudes: pendientes para mecánicos disponibles"
  on public.solicitudes for select to authenticated
  using (
    estado = 'pendiente'
    and mecanico_id is null
    and exists (select 1 from public.mecanicos where usuario_id = auth.uid() and disponible)
    and public.es_destinatario_solicitud(taller_solicitado_id, mecanico_solicitado_id)
    and not (coalesce(public.mecanico_id_actual() = any (mecanicos_rechazados), false))
  );

-- 3. ...ni la puede tomar aunque llame a la API
create or replace function public.fn_bloquear_mecanico_rechazado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.mecanico_id is not null
     and new.mecanico_id is distinct from old.mecanico_id
     and new.mecanico_id = any (old.mecanicos_rechazados) then
    raise exception 'El cliente ya rechazó tu precio para esta solicitud.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_bloquear_mecanico_rechazado on public.solicitudes;
create trigger trg_bloquear_mecanico_rechazado
  before update of mecanico_id on public.solicitudes
  for each row execute function public.fn_bloquear_mecanico_rechazado();

revoke execute on function public.fn_bloquear_mecanico_rechazado() from public, anon, authenticated;

-- 4. Rechazar el precio
create or replace function public.rechazar_presupuesto(p_solicitud_id uuid, p_motivo text default null)
returns public.solicitudes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
  v_mecanico  uuid;
  v_motivo    text := coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Rechazaste el precio');
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null or v_solicitud.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede rechazar el precio.' using errcode = 'P0001';
  end if;
  if v_solicitud.estado <> 'aceptado' then
    raise exception 'Esta solicitud no tiene un precio para rechazar.' using errcode = 'P0001';
  end if;

  select usuario_id into v_mecanico from public.mecanicos where id = v_solicitud.mecanico_id;
  perform set_config('rider.nota', v_motivo, true);

  if v_solicitud.taller_solicitado_id is not null or v_solicitud.mecanico_solicitado_id is not null then
    -- Pedida a un taller o a un mecánico puntual: no hay a quién más ofrecerla.
    update public.solicitudes
       set estado = 'cancelada', motivo_cancelacion = v_motivo, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;

    -- El aviso de cancelación no sale cuando cancela el cliente: se avisa acá.
    if v_mecanico is not null then
      insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
      values (v_mecanico, 'El cliente rechazó tu precio', 'La solicitud se canceló.', p_solicitud_id);
    end if;
  else
    -- Del SOS: vuelve a estar disponible para los demás mecánicos.
    update public.solicitudes
       set estado = 'pendiente',
           mecanicos_rechazados = array_append(mecanicos_rechazados, mecanico_id),
           mecanico_id = null,
           monto_final = null,
           eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
  end if;

  delete from public.ubicaciones_mecanico where solicitud_id = p_solicitud_id;
  return v_solicitud;
end;
$function$;

revoke execute on function public.rechazar_presupuesto(uuid, text) from public, anon;
grant execute on function public.rechazar_presupuesto(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
