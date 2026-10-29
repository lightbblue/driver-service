-- =============================================================================
-- REQ-05 — Máquina de estados del servicio y bitácora
--
-- RF-STATE-001..005, RF-MATCH-003/004, RF-ASSIST-008, RF-DATA-004
-- RN-002, RN-003, RN-004, RN-005, RN-009, RN-010
--
-- Requiere 20261022120000_solicitudes_estructura.sql. Es idempotente.
-- =============================================================================

begin;

-- RN-004: el servicio solo avanza por el flujo definido; RN-005: finalizado es terminal;
-- RN-009: se cancela solo antes de trabajando.
create or replace function public.transicion_valida(p_desde text, p_hasta text)
returns boolean
language sql
immutable
as $$
  select case p_desde
    when 'pendiente'  then p_hasta in ('aceptado', 'cancelada')
    when 'aceptado'   then p_hasta in ('en_camino', 'cancelada')
    when 'en_camino'  then p_hasta in ('llegue', 'cancelada')
    when 'llegue'     then p_hasta in ('trabajando', 'cancelada')
    when 'trabajando' then p_hasta = 'finalizado'
    else false
  end;
$$;

-- Valida cada cambio de estado y lo registra en la bitácora (RF-DATA-004) con el
-- estado anterior, el actor y la nota. La nota llega desde
-- cambiar_estado_solicitud() en la variable de transacción `rider.nota`.
create or replace function public.fn_validar_transicion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en := now();

  if new.estado is distinct from old.estado then
    if not public.transicion_valida(old.estado, new.estado) then
      raise exception 'No se puede pasar de "%" a "%".', old.estado, new.estado using errcode = 'P0003';
    end if;

    insert into public.historial_solicitudes (solicitud_id, estado_anterior, estado, nota, usuario_id)
    values (new.id, old.estado, new.estado, nullif(current_setting('rider.nota', true), ''), auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_transicion on public.solicitudes;
create trigger trg_validar_transicion
  before update on public.solicitudes
  for each row execute function public.fn_validar_transicion();

-- Alta de la solicitud: se fuerza el estado inicial, se aplica RN-010 y se
-- registra el primer hito de la bitácora.
create or replace function public.fn_validar_alta_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.estado := 'pendiente';
  new.mecanico_id := null;

  -- RN-010: una sola solicitud activa por cliente. El bloqueo por usuario evita
  -- que dos altas simultáneas pasen las dos.
  perform pg_advisory_xact_lock(hashtext('solicitud-activa:' || new.usuario_id::text));
  if exists (
    select 1 from public.solicitudes
    where usuario_id = new.usuario_id
      and estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando')
  ) then
    raise exception 'Ya tenés una solicitud en curso. Cancelala o esperá a que finalice antes de pedir otra.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_alta_solicitud on public.solicitudes;
create trigger trg_validar_alta_solicitud
  before insert on public.solicitudes
  for each row execute function public.fn_validar_alta_solicitud();

create or replace function public.fn_registrar_alta_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.historial_solicitudes (solicitud_id, estado_anterior, estado, usuario_id)
  values (new.id, null, new.estado, new.usuario_id);
  return new;
end;
$$;

drop trigger if exists trg_registrar_alta_solicitud on public.solicitudes;
create trigger trg_registrar_alta_solicitud
  after insert on public.solicitudes
  for each row execute function public.fn_registrar_alta_solicitud();

-- Taller del usuario autenticado, o null si no es mecánico.
create or replace function public.mecanico_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.mecanicos where usuario_id = auth.uid() limit 1;
$$;

-- RF-MATCH-003 / RF-MATCH-004 / RN-002 / RN-003: aceptación atómica.
-- La condición "mecanico_id is null" dentro del UPDATE es la que hace que, ante
-- dos aceptaciones simultáneas, solo una prospere.
create or replace function public.aceptar_solicitud(p_solicitud_id uuid, p_eta_minutos integer default null)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mecanico  public.mecanicos;
  v_solicitud public.solicitudes;
begin
  select * into v_mecanico from public.mecanicos where usuario_id = auth.uid();

  if v_mecanico.id is null then
    raise exception 'Solo un mecánico puede aceptar una solicitud.' using errcode = 'P0001';
  end if;
  if not v_mecanico.disponible then
    raise exception 'Marcate como disponible para aceptar solicitudes.' using errcode = 'P0001';
  end if;

  update public.solicitudes
     set mecanico_id = v_mecanico.id,
         estado      = 'aceptado',
         eta_minutos = p_eta_minutos
   where id = p_solicitud_id
     and mecanico_id is null
     and estado = 'pendiente'
  returning * into v_solicitud;

  if v_solicitud.id is null then
    raise exception 'Otro mecánico ya aceptó esta solicitud.' using errcode = 'P0002';
  end if;

  return v_solicitud;
end;
$$;

-- Única vía para cambiar el estado. Decide quién puede pedir cada cambio; el
-- trigger valida la transición y escribe la bitácora.
create or replace function public.cambiar_estado_solicitud(
  p_solicitud_id uuid,
  p_estado       text,
  p_nota         text    default null,
  p_eta_minutos  integer default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
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

  update public.solicitudes
     set estado      = p_estado,
         eta_minutos = case when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos) end
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$$;

-- Ayudantes para las políticas RLS (sin recursión entre tablas).
create or replace function public.participa_en_solicitud(p_solicitud_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.solicitudes s
    where s.id = p_solicitud_id
      and (s.usuario_id = auth.uid()
           or (s.mecanico_id is not null and s.mecanico_id = public.mecanico_id_actual()))
  );
$$;

revoke all on function public.aceptar_solicitud(uuid, integer) from public, anon;
revoke all on function public.cambiar_estado_solicitud(uuid, text, text, integer) from public, anon;
revoke all on function public.mecanico_id_actual() from public, anon;
revoke all on function public.participa_en_solicitud(uuid) from public, anon;
revoke all on function public.fn_validar_transicion() from public, anon, authenticated;
revoke all on function public.fn_validar_alta_solicitud() from public, anon, authenticated;
revoke all on function public.fn_registrar_alta_solicitud() from public, anon, authenticated;
grant execute on function public.aceptar_solicitud(uuid, integer) to authenticated;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer) to authenticated;
grant execute on function public.mecanico_id_actual() to authenticated;
grant execute on function public.participa_en_solicitud(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
