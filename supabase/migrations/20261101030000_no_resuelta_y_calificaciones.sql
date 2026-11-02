-- Servicio no resuelto y calificación del mecánico.
-- - Nuevo estado terminal `no_resuelta`: lo marca el mecánico asignado desde `trabajando`,
--   con motivo obligatorio. El cobro se devuelve igual que en una cancelación.
-- - Calificaciones de 1 a 5 estrellas (RF-RATING-001/002, RN-011): solo el cliente,
--   solo un servicio finalizado y una sola vez.
-- - Funciones de lectura para el perfil del mecánico y el promedio de cada taller.

begin;

-- 1. Estado nuevo en la solicitud y en la bitácora
alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
alter table public.solicitudes add constraint solicitudes_estado_check check (
  estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'no_resuelta', 'cancelada')
) not valid;

alter table public.historial_solicitudes drop constraint if exists historial_solicitudes_estado_check;
alter table public.historial_solicitudes add constraint historial_solicitudes_estado_check check (
  estado in ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'no_resuelta', 'cancelada')
) not valid;

alter table public.solicitudes add column if not exists motivo_no_resuelta text;

comment on column public.solicitudes.motivo_no_resuelta is
  'Por qué el mecánico no pudo resolver el problema. Obligatorio al pasar a no_resuelta.';

-- 2. Desde trabajando se termina resuelto o no resuelto
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
    when 'trabajando' then p_hasta in ('finalizado', 'no_resuelta')
    else false
  end;
$$;

-- 3. No resuelta: se devuelve lo retenido y se anula lo pendiente, como al cancelar
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
    elsif new.estado in ('cancelada', 'no_resuelta') then
      update public.pagos
         set estado = case estado when 'retenido' then 'devuelto' else 'anulado' end,
             actualizado_en = now()
       where solicitud_id = new.id and estado in ('retenido', 'pendiente');
    end if;
  end if;

  return new;
end;
$function$;

-- 4. cambiar_estado_solicitud: rama nueva para no_resuelta (misma firma)
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

revoke execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;

-- 5. Calificaciones: una por solicitud. La app solo las lee; se escriben con calificar_servicio().
create table if not exists public.calificaciones (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null unique references public.solicitudes (id) on delete cascade,
  cliente_id   uuid not null references auth.users (id) on delete cascade,
  mecanico_id  uuid not null references public.mecanicos (id) on delete cascade,
  puntaje      smallint not null check (puntaje between 1 and 5),
  comentario   text check (comentario is null or char_length(comentario) <= 300),
  creado_en    timestamptz not null default now()
);

comment on table public.calificaciones is
  'Calificación de 1 a 5 estrellas que el cliente da a un servicio finalizado (RF-RATING-001, RN-011).';

create index if not exists calificaciones_mecanico_id_idx on public.calificaciones (mecanico_id);
create index if not exists calificaciones_cliente_id_idx on public.calificaciones (cliente_id);

alter table public.calificaciones enable row level security;

drop policy if exists "calificaciones: cliente o mecánico del servicio" on public.calificaciones;
create policy "calificaciones: cliente o mecánico del servicio"
  on public.calificaciones for select
  to authenticated
  using (cliente_id = auth.uid() or mecanico_id = public.mecanico_id_actual());

-- 6. calificar_servicio: valida RN-011 en la base
create or replace function public.calificar_servicio(
  p_solicitud_id uuid,
  p_puntaje integer,
  p_comentario text default null
)
returns public.calificaciones
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud    public.solicitudes;
  v_calificacion public.calificaciones;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  if p_puntaje is null or p_puntaje < 1 or p_puntaje > 5 then
    raise exception 'Elegí entre 1 y 5 estrellas.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  if v_solicitud.usuario_id <> auth.uid() then
    raise exception 'Solo el cliente de la solicitud puede calificarla.' using errcode = 'P0001';
  end if;

  if v_solicitud.estado <> 'finalizado' or v_solicitud.mecanico_id is null then
    raise exception 'Solo se puede calificar un servicio resuelto.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.calificaciones where solicitud_id = p_solicitud_id) then
    raise exception 'Ya calificaste este servicio.' using errcode = 'P0001';
  end if;

  insert into public.calificaciones (solicitud_id, cliente_id, mecanico_id, puntaje, comentario)
  values (
    v_solicitud.id,
    v_solicitud.usuario_id,
    v_solicitud.mecanico_id,
    p_puntaje,
    nullif(btrim(coalesce(p_comentario, '')), '')
  )
  returning * into v_calificacion;

  return v_calificacion;
end;
$function$;

-- 7. Promedio de estrellas y servicios resueltos de cada taller (para el mapa y el inicio)
create or replace function public.resumen_mecanicos()
returns table (mecanico_id uuid, promedio numeric, cantidad integer, resueltas integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.id,
         (select round(avg(c.puntaje), 1) from public.calificaciones c where c.mecanico_id = m.id),
         (select count(*)::integer from public.calificaciones c where c.mecanico_id = m.id),
         (select count(*)::integer from public.solicitudes s where s.mecanico_id = m.id and s.estado = 'finalizado')
    from public.mecanicos m;
$$;

-- 8. Estadísticas del perfil del mecánico autenticado
create or replace function public.estadisticas_mecanico_actual()
returns table (solicitudes integer, resueltas integer, calificacion numeric, cantidad_calificaciones integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select (select count(*)::integer from public.solicitudes s where s.mecanico_id = m.id),
         (select count(*)::integer from public.solicitudes s where s.mecanico_id = m.id and s.estado = 'finalizado'),
         (select round(avg(c.puntaje), 1) from public.calificaciones c where c.mecanico_id = m.id),
         (select count(*)::integer from public.calificaciones c where c.mecanico_id = m.id)
    from public.mecanicos m
   where m.usuario_id = auth.uid();
$$;

revoke execute on function public.calificar_servicio(uuid, integer, text) from public, anon;
revoke execute on function public.resumen_mecanicos() from public, anon;
revoke execute on function public.estadisticas_mecanico_actual() from public, anon;
grant execute on function public.calificar_servicio(uuid, integer, text) to authenticated;
grant execute on function public.resumen_mecanicos() to authenticated;
grant execute on function public.estadisticas_mecanico_actual() to authenticated;

-- 9. Realtime: el mecánico ve la calificación sin recargar
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calificaciones'
  ) then
    alter publication supabase_realtime add table public.calificaciones;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
