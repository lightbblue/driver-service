-- El precio lo propone el mecánico y el cliente lo acepta. Disponibilidad del mecánico.
-- - Al pedir, el cliente solo elige el problema: la solicitud se crea sin precio ni cobro.
-- - El mecánico acepta la solicitud poniéndole precio → estado `aceptado` ("Precio enviado").
-- - El cliente acepta el precio y elige el medio de pago → se registra el cobro (retenido o
--   pendiente) y el servicio pasa a `en_camino`. Si lo rechaza, vuelve a `pendiente` y
--   otro mecánico (o el mismo) puede proponer otro precio.
-- - El mecánico activa o desactiva su disponibilidad (RF-PROF-003, RN-003).

begin;

-- 1. La solicitud se crea sin precio ni cobro
drop trigger if exists trg_tarifa_solicitud on public.solicitudes;
drop trigger if exists trg_crear_pago_solicitud on public.solicitudes;
drop function if exists public.fn_tarifa_solicitud();
drop function if exists public.fn_crear_pago_solicitud();

comment on column public.solicitudes.monto_final is
  'Precio del servicio en pesos. Lo propone el mecánico al aceptar y el cliente lo acepta antes de que salga.';
comment on column public.categorias_averia.tarifa is
  'Sin uso: el precio lo propone el mecánico en cada solicitud.';

-- 2. Rechazar el precio devuelve la solicitud a pendiente
create or replace function public.transicion_valida(p_desde text, p_hasta text)
returns boolean
language sql
immutable
as $$
  select case p_desde
    when 'pendiente'     then p_hasta in ('aceptado', 'cancelada')
    when 'aceptado'      then p_hasta in ('en_camino', 'pendiente', 'cancelada')
    when 'en_camino'     then p_hasta in ('llegue', 'cancelada')
    when 'llegue'        then p_hasta in ('trabajando', 'cancelada')
    when 'trabajando'    then p_hasta in ('por_confirmar', 'no_resuelta')
    when 'por_confirmar' then p_hasta in ('finalizado', 'no_resuelta')
    else false
  end;
$$;

-- 3. Cambios de estado: aceptar exige el precio; salir en camino lo decide el cliente
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

  -- Aceptar = proponer el precio. El servicio espera a que el cliente lo acepte.
  if p_estado = 'aceptado' then
    if p_monto_final is null or p_monto_final <= 0 or p_monto_final > 10000000 then
      raise exception 'Indicá el precio del servicio.' using errcode = 'P0001';
    end if;
    perform public.aceptar_solicitud(p_solicitud_id, p_eta_minutos);
    update public.solicitudes
       set monto_final = round(p_monto_final, 2)
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

  -- Salir en camino ocurre cuando el cliente acepta el precio (aceptar_presupuesto).
  if p_estado = 'en_camino' then
    raise exception 'El cliente tiene que aceptar el precio antes de que salgas.' using errcode = 'P0001';
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

  -- El resto (llegar, terminar el trabajo) lo hace el mecánico asignado.
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  update public.solicitudes
     set estado = p_estado
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$function$;

revoke execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;

-- 4. El cliente acepta el precio: elige cómo pagar, se registra el cobro y el mecánico sale
create or replace function public.aceptar_presupuesto(p_solicitud_id uuid, p_medio text)
returns public.solicitudes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
  v_neto      numeric(12, 2);
begin
  if p_medio is null or p_medio not in ('mercado_pago', 'efectivo') then
    raise exception 'Elegí cómo vas a pagar.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null or v_solicitud.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede aceptar el precio.' using errcode = 'P0001';
  end if;
  if v_solicitud.estado <> 'aceptado' or v_solicitud.monto_final is null then
    raise exception 'Esta solicitud no tiene un precio para aceptar.' using errcode = 'P0001';
  end if;

  -- RN-012: neto 90 % redondeado a 2 decimales; la comisión absorbe la diferencia.
  v_neto := round(v_solicitud.monto_final * 0.90, 2);

  insert into public.pagos (solicitud_id, cliente_id, mecanico_id, monto, comision, neto_mecanico, medio, estado)
  values (
    v_solicitud.id, v_solicitud.usuario_id, v_solicitud.mecanico_id,
    v_solicitud.monto_final, v_solicitud.monto_final - v_neto, v_neto,
    p_medio,
    case when p_medio = 'mercado_pago' then 'retenido' else 'pendiente' end
  )
  on conflict (solicitud_id) do update
     set mecanico_id = excluded.mecanico_id, monto = excluded.monto, comision = excluded.comision,
         neto_mecanico = excluded.neto_mecanico, medio = excluded.medio, estado = excluded.estado,
         actualizado_en = now();

  perform set_config('rider.nota', 'Precio aceptado', true);
  update public.solicitudes
     set medio_pago = p_medio, estado = 'en_camino'
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$function$;

-- 5. El cliente rechaza el precio: la solicitud vuelve a buscar mecánico
create or replace function public.rechazar_presupuesto(p_solicitud_id uuid, p_motivo text default null)
returns public.solicitudes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
begin
  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null or v_solicitud.usuario_id is distinct from auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede rechazar el precio.' using errcode = 'P0001';
  end if;
  if v_solicitud.estado <> 'aceptado' then
    raise exception 'Esta solicitud no tiene un precio para rechazar.' using errcode = 'P0001';
  end if;

  perform set_config('rider.nota', coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Precio rechazado'), true);
  update public.solicitudes
     set estado = 'pendiente', mecanico_id = null, monto_final = null, eta_minutos = null
   where id = p_solicitud_id
  returning * into v_solicitud;

  delete from public.ubicaciones_mecanico where solicitud_id = p_solicitud_id;
  return v_solicitud;
end;
$function$;

-- 6. Disponibilidad del mecánico (RF-PROF-003): sin disponibilidad no ve ni acepta solicitudes nuevas (RN-003)
create or replace function public.cambiar_disponibilidad(p_disponible boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.mecanicos set disponible = p_disponible where usuario_id = auth.uid();
  if not found then
    raise exception 'Solo un mecánico puede cambiar su disponibilidad.' using errcode = 'P0001';
  end if;
  return p_disponible;
end;
$function$;

-- 7. Avisos de cada paso
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

  select usuario_id into v_mecanico from public.mecanicos where id = coalesce(new.mecanico_id, old.mecanico_id);

  case new.estado
    when 'aceptado' then
      v_titulo := 'Te enviaron un precio';
      v_cuerpo := 'Un mecánico aceptó tu solicitud y te pasó el precio. Aceptalo para que salga hacia tu ubicación.';
    when 'pendiente' then
      -- El cliente rechazó el precio.
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
revoke execute on function public.aceptar_presupuesto(uuid, text) from public, anon;
revoke execute on function public.rechazar_presupuesto(uuid, text) from public, anon;
revoke execute on function public.cambiar_disponibilidad(boolean) from public, anon;
grant execute on function public.aceptar_presupuesto(uuid, text) to authenticated;
grant execute on function public.rechazar_presupuesto(uuid, text) to authenticated;
grant execute on function public.cambiar_disponibilidad(boolean) to authenticated;

commit;

notify pgrst, 'reload schema';
