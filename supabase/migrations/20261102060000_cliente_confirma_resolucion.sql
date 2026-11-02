-- El cliente confirma que el problema quedó resuelto antes de que se cobre.
-- Antes el mecánico pasaba de "trabajando" a "finalizado" y eso cobraba. Ahora:
-- - el mecánico marca "terminé el trabajo" → estado `por_confirmar` (el pago sigue retenido);
-- - el cliente confirma "quedó resuelto" → `finalizado` (se cobra) o
--   "no quedó resuelto" → `no_resuelta` (se devuelve), con motivo.
-- - Desde "trabajando" el mecánico puede seguir marcando "no se pudo resolver".

begin;

-- 1. Estado nuevo
alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
alter table public.solicitudes add constraint solicitudes_estado_check check (
  estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'por_confirmar',
             'finalizado', 'no_resuelta', 'cancelada')
) not valid;

alter table public.historial_solicitudes drop constraint if exists historial_solicitudes_estado_check;
alter table public.historial_solicitudes add constraint historial_solicitudes_estado_check check (
  estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'por_confirmar',
             'finalizado', 'no_resuelta', 'cancelada')
) not valid;

create or replace function public.transicion_valida(p_desde text, p_hasta text)
returns boolean
language sql
immutable
as $$
  select case p_desde
    when 'pendiente'     then p_hasta in ('aceptado', 'cancelada')
    when 'aceptado'      then p_hasta in ('en_camino', 'cancelada')
    when 'en_camino'     then p_hasta in ('llegue', 'cancelada')
    when 'llegue'        then p_hasta in ('trabajando', 'cancelada')
    when 'trabajando'    then p_hasta in ('por_confirmar', 'no_resuelta')
    when 'por_confirmar' then p_hasta in ('finalizado', 'no_resuelta')
    else false
  end;
$$;

-- 2. RN-010: "esperando confirmación" también cuenta como solicitud activa
create or replace function public.fn_validar_alta_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.estado := 'pendiente';
  new.mecanico_id := null;

  perform pg_advisory_xact_lock(hashtext('solicitud-activa:' || new.usuario_id::text));
  if exists (
    select 1 from public.solicitudes
    where usuario_id = new.usuario_id
      and estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'por_confirmar')
  ) then
    raise exception 'Ya tenés una solicitud en curso. Cancelala o esperá a que finalice antes de pedir otra.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_validar_alta_solicitud() from public, anon, authenticated;

-- 3. Quién hace cada paso
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

  -- Aceptar implica salir en camino: se registran los dos hitos.
  if p_estado = 'aceptado' then
    perform public.aceptar_solicitud(p_solicitud_id, p_eta_minutos);
    perform set_config('rider.nota', '', true);
    update public.solicitudes
       set estado = 'en_camino'
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  v_es_cliente  := coalesce(v_solicitud.usuario_id = auth.uid(), false);
  v_es_asignado := coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false);

  if p_estado = 'cancelada' then
    if not (v_es_cliente or v_es_asignado) then
      raise exception 'No tenés permiso para cancelar esta solicitud.' using errcode = 'P0001';
    end if;
    if v_nota is null and v_solicitud.mecanico_id is not null then
      raise exception 'Indicá el motivo de la cancelación.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'cancelada', motivo_cancelacion = v_nota, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- El trabajo empieza cuando el cliente confirma que el mecánico llegó.
  if p_estado = 'trabajando' then
    if not v_es_cliente then
      raise exception 'El cliente tiene que confirmar que llegaste para empezar el trabajo.' using errcode = 'P0001';
    end if;
    update public.solicitudes set estado = 'trabajando' where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- Se cobra cuando el cliente confirma que quedó resuelto.
  if p_estado = 'finalizado' then
    if not v_es_cliente then
      raise exception 'El cliente tiene que confirmar que quedó resuelto para cobrar el servicio.' using errcode = 'P0001';
    end if;
    update public.solicitudes set estado = 'finalizado', eta_minutos = null where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- No resuelta: el mecánico mientras trabaja, o el cliente al revisar el trabajo terminado.
  if p_estado = 'no_resuelta' then
    if not ((v_es_asignado and v_solicitud.estado = 'trabajando')
            or (v_es_cliente and v_solicitud.estado = 'por_confirmar')) then
      raise exception 'No podés marcar esta solicitud como no resuelta.' using errcode = 'P0001';
    end if;
    if v_nota is null then
      raise exception 'Indicá por qué no se pudo resolver.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'no_resuelta', motivo_no_resuelta = v_nota, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- El resto (salir, llegar, terminar el trabajo) lo hace el mecánico asignado.
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
$function$;

revoke execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;

-- 4. Avisos: cada paso le avisa al otro
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
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  select usuario_id into v_mecanico from public.mecanicos where id = new.mecanico_id;

  case new.estado
    when 'en_camino' then
      v_titulo := 'Un mecánico va en camino';
      v_cuerpo := case when new.eta_minutos is not null
                       then 'Llega en aproximadamente ' || new.eta_minutos || ' min.'
                       else 'Aceptó tu solicitud y salió hacia tu ubicación.' end;
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
