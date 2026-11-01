-- Monto final del servicio y pago simulado con comisión.
-- RF-QUOTE-001, RF-STATE-005, RF-PAY-002, RN-007, RN-012, RN-013, RN-014, RNF-SEC-005.

-- 1. Monto final: lo carga el mecánico asignado al finalizar (RN-014).
alter table public.solicitudes
  add column if not exists monto_final numeric(12, 2)
  check (monto_final is null or monto_final > 0);

comment on column public.solicitudes.monto_final is
  'Monto total del servicio en pesos. Lo carga el mecánico asignado al pasar a finalizado (RN-014).';

-- 2. cambiar_estado_solicitud ahora recibe el monto final. Cambia la firma, así que se recrea.
drop function if exists public.cambiar_estado_solicitud(uuid, text, text, integer);

create function public.cambiar_estado_solicitud(
  p_solicitud_id uuid,
  p_estado text,
  p_nota text default null,
  p_eta_minutos integer default null,
  p_monto_final numeric default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud   public.solicitudes;
  v_nota        text := nullif(btrim(coalesce(p_nota, '')), '');
  v_es_cliente  boolean;
  v_es_asignado boolean;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  perform set_config('rider.nota', coalesce(v_nota, ''), true);

  if p_estado = 'aceptado' then
    return public.aceptar_solicitud(p_solicitud_id, p_eta_minutos);
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  -- coalesce: para quien no es mecánico, mecanico_id_actual() es null y la
  -- comparación daría null, que un `if not` dejaría pasar.
  v_es_cliente  := coalesce(v_solicitud.usuario_id = auth.uid(), false);
  v_es_asignado := coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false);

  if p_estado = 'cancelada' then
    -- RF-ASSIST-008: cancela el cliente o el mecánico asignado, con registro del actor.
    if not (v_es_cliente or v_es_asignado) then
      raise exception 'No tenés permiso para cancelar esta solicitud.' using errcode = 'P0001';
    end if;
    -- Con un mecánico ya involucrado, la cancelación debe explicarse.
    if v_nota is null and v_solicitud.mecanico_id is not null then
      raise exception 'Indicá el motivo de la cancelación.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'cancelada', motivo_cancelacion = v_nota, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- RF-STATE-002..005: solo el mecánico asignado opera el servicio.
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  -- RN-014: para finalizar hace falta el monto, y solo se carga al finalizar.
  if p_estado = 'finalizado' and (p_monto_final is null or p_monto_final <= 0) then
    raise exception 'Indicá el monto final del servicio.' using errcode = 'P0001';
  end if;

  update public.solicitudes
     set estado      = p_estado,
         eta_minutos = case when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos) end,
         monto_final = case when p_estado = 'finalizado' then round(p_monto_final, 2) else monto_final end
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$function$;

revoke execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;

-- 3. Pagos: uno por solicitud. La app solo los lee; se escriben con registrar_pago().
create table if not exists public.pagos (
  id             uuid primary key default gen_random_uuid(),
  solicitud_id   uuid not null unique references public.solicitudes (id) on delete cascade,
  cliente_id     uuid not null references auth.users (id) on delete cascade,
  mecanico_id    uuid references public.mecanicos (id) on delete set null,
  monto          numeric(12, 2) not null check (monto > 0),
  comision       numeric(12, 2) not null check (comision >= 0),
  neto_mecanico  numeric(12, 2) not null check (neto_mecanico >= 0),
  medio          text not null default 'simulado' check (medio = 'simulado'),
  estado         text not null default 'aprobado' check (estado = 'aprobado'),
  creado_en      timestamptz not null default now(),
  check (comision + neto_mecanico = monto)
);

comment on table public.pagos is
  'Pago simulado de un servicio (RF-PAY-002). Comisión 10 % para la plataforma, 90 % neto para el mecánico (RN-012).';

create index if not exists pagos_mecanico_id_idx on public.pagos (mecanico_id);
create index if not exists pagos_cliente_id_idx on public.pagos (cliente_id);

alter table public.pagos enable row level security;

-- RF-SEC-001: lo ven solo el cliente y el mecánico del servicio. Sin INSERT/UPDATE/DELETE desde la app.
drop policy if exists "pagos: cliente o mecánico del servicio" on public.pagos;
create policy "pagos: cliente o mecánico del servicio"
  on public.pagos for select
  to authenticated
  using (cliente_id = auth.uid() or mecanico_id = public.mecanico_id_actual());

-- 4. registrar_pago: valida RN-013 y calcula RN-012 en el servidor (RN-007).
create or replace function public.registrar_pago(p_solicitud_id uuid)
returns public.pagos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
  v_neto      numeric(12, 2);
  v_pago      public.pagos;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  if v_solicitud.usuario_id <> auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede pagarla.' using errcode = 'P0001';
  end if;

  if v_solicitud.estado <> 'finalizado' then
    raise exception 'Solo se puede pagar un servicio finalizado.' using errcode = 'P0001';
  end if;

  if v_solicitud.monto_final is null then
    raise exception 'El mecánico todavía no cargó el monto del servicio.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.pagos where solicitud_id = p_solicitud_id) then
    raise exception 'Este servicio ya está pagado.' using errcode = 'P0001';
  end if;

  -- RN-012: neto 90 % redondeado a 2 decimales; la comisión absorbe la diferencia.
  v_neto := round(v_solicitud.monto_final * 0.90, 2);

  insert into public.pagos (solicitud_id, cliente_id, mecanico_id, monto, comision, neto_mecanico)
  values (
    v_solicitud.id,
    v_solicitud.usuario_id,
    v_solicitud.mecanico_id,
    v_solicitud.monto_final,
    v_solicitud.monto_final - v_neto,
    v_neto
  )
  returning * into v_pago;

  return v_pago;
end;
$function$;

revoke execute on function public.registrar_pago(uuid) from public, anon;
grant execute on function public.registrar_pago(uuid) to authenticated;

-- 5. Realtime: el mecánico ve "Pagado" sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pagos'
  ) then
    alter publication supabase_realtime add table public.pagos;
  end if;
end $$;
