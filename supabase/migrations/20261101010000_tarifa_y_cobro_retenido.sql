-- Precio por adelantado y cobro retenido, como en las apps de viaje (pago simulado).
-- - Cada tipo de avería tiene una tarifa fija: el cliente la ve antes de pedir y no cambia.
-- - Al pedir con Mercado Pago (simulado) el monto queda retenido; en efectivo queda pendiente.
-- - Al finalizar se cobra; si se cancela, lo retenido se devuelve (y lo pendiente se anula).
-- - El mecánico registra menos pasos: aceptar = aceptado + en camino; llegué = llegada + trabajando.
--   La base sigue registrando los 6 estados en la bitácora (RF-VIEW-008).
-- Todo lo hace la base con triggers (RN-007): la app no puede fijar el monto ni el estado del pago.

-- 1. Tarifa por categoría
alter table public.categorias_averia
  add column if not exists tarifa numeric(12, 2) check (tarifa is null or tarifa > 0);

update public.categorias_averia c
   set tarifa = t.tarifa
  from (values
    ('Sin combustible', 12000),
    ('Pinchadura', 18000),
    ('Batería', 15000),
    ('Problemas de cadena', 16000),
    ('Problemas de arranque', 20000),
    ('Otro problema', 20000),
    ('Falla mecánica', 28000),
    ('Accidente', 35000)
  ) as t(nombre, tarifa)
 where c.nombre = t.nombre;

comment on column public.categorias_averia.tarifa is
  'Precio fijo del servicio en pesos. Se muestra antes de pedir y se copia a la solicitud.';

-- 2. Medio de pago elegido al pedir
alter table public.solicitudes
  add column if not exists medio_pago text not null default 'mercado_pago'
  check (medio_pago in ('mercado_pago', 'efectivo'));

comment on column public.solicitudes.monto_final is
  'Monto del servicio en pesos. Lo fija la base al crear la solicitud con la tarifa de la categoría.';

-- 3. Pagos: medios y estados nuevos
alter table public.pagos drop constraint if exists pagos_medio_check;
alter table public.pagos drop constraint if exists pagos_estado_check;
alter table public.pagos alter column medio drop default;
alter table public.pagos alter column estado drop default;
alter table public.pagos
  add constraint pagos_medio_check check (medio in ('mercado_pago', 'efectivo')),
  add constraint pagos_estado_check check (estado in ('retenido', 'pendiente', 'cobrado', 'devuelto', 'anulado'));
alter table public.pagos add column if not exists actualizado_en timestamptz not null default now();

comment on table public.pagos is
  'Cobro simulado de un servicio. Mercado Pago: retenido → cobrado | devuelto. Efectivo: pendiente → cobrado | anulado. Comisión 10 %, neto 90 % (RN-012).';

-- 4. Al crear la solicitud: el monto sale de la tarifa (la app no lo puede fijar)
create or replace function public.fn_tarifa_solicitud()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  select tarifa into new.monto_final from public.categorias_averia where id = new.categoria_id;
  if new.monto_final is null then
    raise exception 'Elegí el tipo de problema para calcular el precio.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_tarifa_solicitud on public.solicitudes;
create trigger trg_tarifa_solicitud
  before insert on public.solicitudes
  for each row execute function public.fn_tarifa_solicitud();

-- 5. Después de crearla: se registra el cobro (retenido o pendiente)
create or replace function public.fn_crear_pago_solicitud()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- RN-012: neto 90 % redondeado a 2 decimales; la comisión absorbe la diferencia.
  v_neto numeric(12, 2) := round(new.monto_final * 0.90, 2);
begin
  insert into public.pagos (solicitud_id, cliente_id, monto, comision, neto_mecanico, medio, estado)
  values (
    new.id,
    new.usuario_id,
    new.monto_final,
    new.monto_final - v_neto,
    v_neto,
    new.medio_pago,
    case when new.medio_pago = 'mercado_pago' then 'retenido' else 'pendiente' end
  );
  return new;
end;
$function$;

drop trigger if exists trg_crear_pago_solicitud on public.solicitudes;
create trigger trg_crear_pago_solicitud
  after insert on public.solicitudes
  for each row execute function public.fn_crear_pago_solicitud();

-- 6. Cada cambio de la solicitud se refleja en el cobro
create or replace function public.fn_sincronizar_pago()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.mecanico_id is distinct from old.mecanico_id then
    update public.pagos
       set mecanico_id = new.mecanico_id, actualizado_en = now()
     where solicitud_id = new.id;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'finalizado' then
      update public.pagos
         set estado = 'cobrado', actualizado_en = now()
       where solicitud_id = new.id and estado in ('retenido', 'pendiente');
    elsif new.estado = 'cancelada' then
      update public.pagos
         set estado = case estado when 'retenido' then 'devuelto' else 'anulado' end,
             actualizado_en = now()
       where solicitud_id = new.id and estado in ('retenido', 'pendiente');
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sincronizar_pago on public.solicitudes;
create trigger trg_sincronizar_pago
  after update of estado, mecanico_id on public.solicitudes
  for each row execute function public.fn_sincronizar_pago();

-- 7. El pago ya no es un paso aparte: se cobra solo al finalizar.
drop function if exists public.registrar_pago(uuid);

-- 8. Menos pasos para el mecánico (la bitácora sigue con los 6 estados).
--    p_monto_final queda en la firma por compatibilidad, pero ya no se usa: el monto es la tarifa.
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

  -- RF-STATE-002..005: solo el mecánico asignado opera el servicio.
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  update public.solicitudes
     set estado      = p_estado,
         eta_minutos = case when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos) end
   where id = p_solicitud_id
  returning * into v_solicitud;

  -- Llegar implica empezar a trabajar: se registran los dos hitos.
  if p_estado = 'llegue' then
    perform set_config('rider.nota', '', true);
    update public.solicitudes
       set estado = 'trabajando'
     where id = p_solicitud_id
    returning * into v_solicitud;
  end if;

  return v_solicitud;
end;
$function$;
