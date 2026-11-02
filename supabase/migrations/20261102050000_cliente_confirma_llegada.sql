-- El cliente confirma que llegó el mecánico.
-- Antes, al marcar "Llegué" la solicitud pasaba sola a "trabajando", y el mecánico podía
-- avanzar todo el servicio (y cobrarlo) sin haber ido. Ahora:
-- - el mecánico marca "llegue" y ahí se queda;
-- - solo el cliente pasa de "llegue" a "trabajando", confirmando que el mecánico está con él.

begin;

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

  -- El trabajo empieza cuando el cliente confirma que el mecánico llegó.
  if p_estado = 'trabajando' then
    if not v_es_cliente then
      raise exception 'El cliente tiene que confirmar que llegaste para empezar el trabajo.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'trabajando'
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- RF-STATE-002..005: el resto del servicio lo opera el mecánico asignado.
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  if p_estado = 'no_resuelta' then
    if v_nota is null then
      raise exception 'Indicá por qué no se pudo resolver.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'no_resuelta', motivo_no_resuelta = v_nota, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
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

-- Avisos: al cliente para que confirme la llegada; al mecánico cuando el cliente confirma.
create or replace function public.fn_notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulo text;
  v_cuerpo text;
  v_destino uuid := new.usuario_id;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

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
      -- Lo confirmó el cliente: el aviso es para el mecánico.
      select usuario_id into v_destino from public.mecanicos where id = new.mecanico_id;
      v_titulo := 'El cliente confirmó tu llegada';
      v_cuerpo := 'Ya podés empezar el trabajo.';
    when 'finalizado' then
      v_titulo := 'Servicio finalizado';
      v_cuerpo := 'Contanos cómo te fue: calificá al mecánico.';
    when 'no_resuelta' then
      v_titulo := 'No se pudo resolver';
      v_cuerpo := coalesce(new.motivo_no_resuelta, 'El mecánico no pudo resolver el problema.') || ' Se te devuelve el pago.';
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
