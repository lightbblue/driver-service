-- RF-QUOTE-001/002, RF-PAY-001/002/003, RN-007, RN-012/013/014, RNF-SEC-005.
-- Adds final service amounts and server-registered simulated payments.

begin;

alter table public.solicitudes
  add column if not exists monto_final numeric(12,2);

alter table public.solicitudes
  drop constraint if exists solicitudes_monto_final_check;

alter table public.solicitudes
  add constraint solicitudes_monto_final_check
  check (monto_final is null or monto_final > 0);

drop function if exists public.cambiar_estado_solicitud(uuid, text, text, integer);

create or replace function public.cambiar_estado_solicitud(
  p_solicitud_id uuid,
  p_estado text,
  p_nota text default null,
  p_eta_minutos integer default null,
  p_monto_final numeric default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_es_cliente boolean;
  v_es_asignado boolean;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  perform set_config('rider.nota', coalesce(v_nota, ''), true);

  if p_estado = 'aceptado' then
    return public.aceptar_solicitud(p_solicitud_id, p_eta_minutos);
  end if;

  select *
    into v_solicitud
    from public.solicitudes
   where id = p_solicitud_id
   for update;

  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  if v_solicitud.estado = 'finalizado' then
    raise exception 'No se puede modificar un servicio que ya está finalizado.' using errcode = 'P0001';
  end if;

  v_es_cliente := coalesce(v_solicitud.usuario_id = auth.uid(), false);
  v_es_asignado := coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false);

  if p_estado = 'cancelada' then
    if not (v_es_cliente or v_es_asignado) then
      raise exception 'No tenés permiso para cancelar esta solicitud.' using errcode = 'P0001';
    end if;
    if v_nota is null and v_solicitud.mecanico_id is not null then
      raise exception 'Indicá el motivo de la cancelación.' using errcode = 'P0001';
    end if;
    if p_monto_final is not null then
      raise exception 'No se puede cargar un monto al cancelar la solicitud.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'cancelada',
           motivo_cancelacion = v_nota,
           eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  if p_estado = 'finalizado' then
    if p_monto_final is null or round(p_monto_final, 2) <= 0 then
      raise exception 'El monto final debe ser mayor que cero.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'finalizado',
           monto_final = round(p_monto_final, 2),
           eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  if p_monto_final is not null then
    raise exception 'Solo se puede cargar el monto final al finalizar el servicio.' using errcode = 'P0001';
  end if;

  update public.solicitudes
     set estado = p_estado,
         eta_minutos = case
           when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos)
           else eta_minutos
         end
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$$;

revoke all on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric)
  from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric)
  to authenticated;

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null unique
    references public.solicitudes (id) on delete restrict,
  cliente_id uuid not null references auth.users (id) on delete restrict,
  mecanico_id uuid not null references public.mecanicos (id) on delete restrict,
  monto numeric(12,2) not null check (monto > 0),
  comision numeric(12,2) not null check (comision >= 0),
  neto_mecanico numeric(12,2) not null check (neto_mecanico >= 0),
  medio text not null default 'simulado' check (medio = 'simulado'),
  estado text not null default 'aprobado' check (estado = 'aprobado'),
  creado_en timestamptz not null default now(),
  constraint pagos_comision_check check (
    neto_mecanico = round(monto * 0.90, 2)
    and comision = monto - neto_mecanico
  )
);

create index if not exists pagos_cliente_idx
  on public.pagos (cliente_id, creado_en desc);
create index if not exists pagos_mecanico_idx
  on public.pagos (mecanico_id, creado_en desc);

alter table public.pagos enable row level security;
revoke all on public.pagos from public, anon, authenticated;
grant select on public.pagos to authenticated;

drop policy if exists "pagos: cliente o mecánico asignado" on public.pagos;
create policy "pagos: cliente o mecánico asignado"
  on public.pagos for select to authenticated
  using (cliente_id = auth.uid() or mecanico_id = public.mecanico_id_actual());

create or replace function public.registrar_pago(p_solicitud_id uuid)
returns public.pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes;
  v_neto numeric(12,2);
  v_comision numeric(12,2);
  v_pago public.pagos;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  select *
    into v_solicitud
    from public.solicitudes
   where id = p_solicitud_id
   for update;

  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;
  if v_solicitud.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el cliente que solicitó el servicio puede pagarlo.' using errcode = 'P0001';
  end if;
  if v_solicitud.estado <> 'finalizado'
     or v_solicitud.monto_final is null
     or v_solicitud.monto_final <= 0 then
    raise exception 'Solo se puede pagar un servicio finalizado con monto cargado.' using errcode = 'P0001';
  end if;
  if v_solicitud.mecanico_id is null then
    raise exception 'La solicitud no tiene un mecánico asignado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pagos where solicitud_id = p_solicitud_id) then
    raise exception 'Este servicio ya fue pagado.' using errcode = 'P0001';
  end if;

  v_neto := round(v_solicitud.monto_final * 0.90, 2);
  v_comision := v_solicitud.monto_final - v_neto;

  insert into public.pagos (
    solicitud_id, cliente_id, mecanico_id, monto, comision,
    neto_mecanico, medio, estado
  ) values (
    v_solicitud.id, v_solicitud.usuario_id, v_solicitud.mecanico_id,
    v_solicitud.monto_final, v_comision, v_neto, 'simulado', 'aprobado'
  )
  returning * into v_pago;

  insert into public.historial_solicitudes (
    solicitud_id, estado_anterior, estado, nota, usuario_id
  ) values (
    v_solicitud.id,
    v_solicitud.estado,
    v_solicitud.estado,
    'Pago aprobado de $' || to_char(v_solicitud.monto_final, 'FM999999990.00'),
    auth.uid()
  );

  return v_pago;
end;
$$;

revoke all on function public.registrar_pago(uuid) from public, anon;
grant execute on function public.registrar_pago(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'pagos'
     ) then
    alter publication supabase_realtime add table public.pagos;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
