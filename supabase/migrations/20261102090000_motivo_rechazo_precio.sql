-- El cliente indica por qué rechaza el precio, y el mecánico se entera aunque la
-- solicitud ya no sea suya (vuelve a "pendiente" para otros, o se cancela).
-- - cotizaciones_rechazadas: precio y motivo de cada rechazo; la lee el mecánico rechazado.
-- - El aviso al mecánico incluye el motivo.

begin;

create table if not exists public.cotizaciones_rechazadas (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  mecanico_id  uuid not null references public.mecanicos (id) on delete cascade,
  monto        numeric(12, 2),
  motivo       text not null,
  creado_en    timestamptz not null default now()
);

comment on table public.cotizaciones_rechazadas is
  'Precios que el cliente rechazó, con su motivo. Los ve solo el mecánico rechazado.';

create index if not exists cotizaciones_rechazadas_solicitud_idx
  on public.cotizaciones_rechazadas (solicitud_id, mecanico_id);

alter table public.cotizaciones_rechazadas enable row level security;
revoke all on public.cotizaciones_rechazadas from anon;
revoke insert, update, delete on public.cotizaciones_rechazadas from authenticated;
grant select on public.cotizaciones_rechazadas to authenticated;

drop policy if exists "cotizaciones_rechazadas: las propias" on public.cotizaciones_rechazadas;
create policy "cotizaciones_rechazadas: las propias"
  on public.cotizaciones_rechazadas for select to authenticated
  using (mecanico_id = public.mecanico_id_actual());

-- Rechazar el precio: motivo obligatorio, queda registrado y se avisa al mecánico con el motivo.
create or replace function public.rechazar_presupuesto(p_solicitud_id uuid, p_motivo text default null)
returns public.solicitudes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
  v_mecanico  uuid;
  v_motivo    text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_dirigida  boolean;
begin
  if v_motivo is null then
    raise exception 'Indicá por qué rechazás el precio.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null or v_solicitud.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede rechazar el precio.' using errcode = 'P0001';
  end if;
  if v_solicitud.estado <> 'aceptado' or v_solicitud.mecanico_id is null then
    raise exception 'Esta solicitud no tiene un precio para rechazar.' using errcode = 'P0001';
  end if;

  v_dirigida := v_solicitud.taller_solicitado_id is not null or v_solicitud.mecanico_solicitado_id is not null;
  select usuario_id into v_mecanico from public.mecanicos where id = v_solicitud.mecanico_id;

  insert into public.cotizaciones_rechazadas (solicitud_id, mecanico_id, monto, motivo)
  values (v_solicitud.id, v_solicitud.mecanico_id, v_solicitud.monto_final, v_motivo);

  -- El aviso lo arma esta función (con el motivo); el trigger de estados no avisa este cambio.
  perform set_config('rider.sin_aviso', '1', true);
  perform set_config('rider.nota', 'Precio rechazado: ' || v_motivo, true);

  if v_dirigida then
    -- Pedida a un taller o a un mecánico puntual: no hay a quién más ofrecerla.
    update public.solicitudes
       set estado = 'cancelada', motivo_cancelacion = 'Precio rechazado: ' || v_motivo, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
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

  perform set_config('rider.sin_aviso', '', true);
  delete from public.ubicaciones_mecanico where solicitud_id = p_solicitud_id;

  if v_mecanico is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
    values (
      v_mecanico,
      'El cliente rechazó tu precio',
      'Motivo: ' || v_motivo || '. ' ||
        case when v_dirigida then 'La solicitud se canceló.'
             else 'La solicitud volvió a estar disponible para otros mecánicos.' end,
      p_solicitud_id
    );
  end if;

  return v_solicitud;
end;
$function$;

revoke execute on function public.rechazar_presupuesto(uuid, text) from public, anon;
grant execute on function public.rechazar_presupuesto(uuid, text) to authenticated;

-- El trigger de avisos respeta "rider.sin_aviso" (el rechazo ya avisa con el motivo).
create or replace function public.fn_notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulo   text;
  v_cuerpo   text;
  v_mecanico uuid;
  v_destino  uuid := new.usuario_id;
begin
  if new.estado is not distinct from old.estado
     or coalesce(current_setting('rider.sin_aviso', true), '') = '1' then
    return new;
  end if;

  select usuario_id into v_mecanico from public.mecanicos where id = coalesce(new.mecanico_id, old.mecanico_id);

  case new.estado
    when 'aceptado' then
      v_titulo := 'Te enviaron un precio';
      v_cuerpo := 'Un mecánico aceptó tu solicitud y te pasó el precio. Aceptalo para que salga hacia tu ubicación.';
    when 'pendiente' then
      v_destino := v_mecanico;
      v_titulo := 'El cliente rechazó tu precio';
      v_cuerpo := 'La solicitud volvió a estar disponible.';
    when 'en_camino' then
      v_destino := v_mecanico;
      v_titulo := 'El cliente aceptó tu precio';
      v_cuerpo := 'Salí hacia su ubicación.';
    when 'llegue' then
      v_titulo := 'El mecánico dice que llegó';
      v_cuerpo := 'Confirmá que está con vos para que empiece el trabajo.';
    when 'trabajando' then
      v_destino := v_mecanico;
      v_titulo := 'El cliente confirmó tu llegada';
      v_cuerpo := 'Ya podés empezar el trabajo.';
    when 'por_confirmar' then
      v_titulo := 'El mecánico terminó el trabajo';
      v_cuerpo := 'Confirmá si quedó resuelto. El pago se libera recién cuando lo confirmes.';
    when 'finalizado' then
      v_destino := v_mecanico;
      v_titulo := 'El cliente confirmó que quedó resuelto';
      v_cuerpo := 'El servicio está cobrado.';
    when 'no_resuelta' then
      if auth.uid() is not distinct from new.usuario_id then
        v_destino := v_mecanico;
        v_titulo := 'El cliente dice que no quedó resuelto';
        v_cuerpo := coalesce(new.motivo_no_resuelta, 'Sin motivo indicado.') || ' El pago se le devuelve.';
      else
        v_titulo := 'No se pudo resolver';
        v_cuerpo := coalesce(new.motivo_no_resuelta, 'El mecánico no pudo resolver el problema.') || ' Se te devuelve el pago.';
      end if;
    when 'cancelada' then
      if auth.uid() is not distinct from new.usuario_id then
        return new;
      end if;
      v_titulo := 'El mecánico canceló la solicitud';
      v_cuerpo := coalesce(new.motivo_cancelacion, 'Sin motivo indicado.') || ' Podés pedir asistencia de nuevo.';
    else
      return new;
  end case;

  if v_destino is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
    values (v_destino, v_titulo, v_cuerpo, new.id);
  end if;

  return new;
end;
$function$;

revoke execute on function public.fn_notificar_cambio_estado() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
