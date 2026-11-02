-- Dueño del taller y pedidos para sumarse.
-- - El mecánico que crea el taller en el registro ("Taller nuevo") queda como dueño.
-- - "Me sumo": el mecánico queda pendiente y al dueño le llega un aviso para aceptarlo o rechazarlo.
--   Mientras espera trabaja en ruta (no recibe los pedidos del taller).
-- - Taller sin dueño (cargado por el equipo): el primero que se suma queda como dueño.
-- - Solo el dueño edita el taller (datos, foto, ubicación) y administra a los miembros.

begin;

-- 1. Dueño y pedidos pendientes
alter table public.talleres
  add column if not exists dueno_id uuid references public.mecanicos (id) on delete set null;

alter table public.mecanicos
  add column if not exists taller_pendiente_id uuid references public.talleres (id) on delete set null;

comment on column public.talleres.dueno_id is 'Mecánico que creó (o reclamó) el taller: lo edita y acepta miembros.';
comment on column public.mecanicos.taller_pendiente_id is 'Taller al que pidió sumarse; espera que el dueño lo acepte.';

-- Talleres que ya tienen mecánico: el primero queda como dueño (hoy, Taller Demo).
update public.talleres t
   set dueno_id = (select m.id from public.mecanicos m
                    where m.taller_id = t.id and m.usuario_id is not null
                    order by m.creado_en limit 1)
 where t.dueno_id is null;

-- 2. Avisos que no son de una solicitud (pedidos para sumarse al taller)
alter table public.notificaciones
  add column if not exists tipo text not null default 'solicitud' check (tipo in ('solicitud', 'taller'));

-- 3. Registro: "Me sumo" queda pendiente y avisa al dueño
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  modo text := coalesce(meta ->> 'taller_modo', case when jsonb_typeof(meta -> 'taller_latitud') = 'number' then 'nuevo' else 'ruta' end);
  tiene_coordenadas boolean :=
    jsonb_typeof(meta -> 'taller_latitud') = 'number'
    and jsonb_typeof(meta -> 'taller_longitud') = 'number';
  v_taller    uuid;
  v_pendiente uuid;
  v_dueno     uuid;
  v_nuevo     boolean := false;
  v_mecanico  uuid;
  v_especialidades text[] := case
    when jsonb_typeof(meta -> 'taller_especialidades') = 'array'
      then array(select jsonb_array_elements_text(meta -> 'taller_especialidades'))
    else '{}'::text[]
  end;
begin
  insert into public.perfiles (id, nombre, telefono)
  values (new.id, coalesce(meta ->> 'nombre', ''), nullif(meta ->> 'telefono', ''))
  on conflict (id) do nothing;

  if coalesce(meta ->> 'rol', '') <> 'mecanico' then
    return new;
  end if;

  if modo = 'existente' and coalesce(meta ->> 'taller_id', '') ~* '^[0-9a-f-]{36}$' then
    select id, dueno_id into v_taller, v_dueno from public.talleres where id = (meta ->> 'taller_id')::uuid;
    -- Con dueño, espera su aprobación; sin dueño, entra directo y lo reclama.
    if v_taller is not null and v_dueno is not null then
      v_pendiente := v_taller;
      v_taller := null;
    elsif v_taller is not null then
      v_nuevo := true;
    end if;
  elsif modo = 'nuevo' and tiene_coordenadas and nullif(btrim(meta ->> 'taller_nombre'), '') is not null then
    insert into public.talleres (nombre, descripcion, telefono, direccion, localidad, latitud, longitud, especialidades)
    values (
      btrim(meta ->> 'taller_nombre'),
      nullif(meta ->> 'taller_descripcion', ''),
      nullif(meta ->> 'telefono', ''),
      coalesce(nullif(meta ->> 'taller_direccion', ''), 'Dirección no indicada'),
      nullif(meta ->> 'taller_ubicacion', ''),
      (meta ->> 'taller_latitud')::double precision,
      (meta ->> 'taller_longitud')::double precision,
      v_especialidades
    )
    returning id into v_taller;
    v_nuevo := true;
  end if;

  insert into public.mecanicos (usuario_id, nombre, descripcion, telefono, localidad, especialidades, disponible, taller_id, taller_pendiente_id)
  values (
    new.id,
    coalesce(nullif(btrim(meta ->> 'nombre'), ''), 'Mecánico'),
    nullif(meta ->> 'taller_descripcion', ''),
    nullif(meta ->> 'telefono', ''),
    nullif(meta ->> 'taller_ubicacion', ''),
    v_especialidades,
    true,
    v_taller,
    v_pendiente
  )
  on conflict (usuario_id) do nothing
  returning id into v_mecanico;

  -- Creó el taller (o reclamó uno sin dueño): queda como dueño.
  if v_nuevo and v_mecanico is not null then
    update public.talleres set dueno_id = v_mecanico where id = v_taller and dueno_id is null;
  end if;

  -- Pidió sumarse: aviso al dueño.
  if v_pendiente is not null and v_mecanico is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, tipo)
    select d.usuario_id,
           'Pedido para sumarse a tu taller',
           coalesce(nullif(btrim(meta ->> 'nombre'), ''), 'Un mecánico') || ' quiere sumarse. Aceptalo o rechazalo desde Mi taller.',
           'taller'
      from public.talleres t
      join public.mecanicos d on d.id = t.dueno_id
     where t.id = v_pendiente and d.usuario_id is not null;
  end if;

  return new;
end;
$function$;

revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;

-- 4. Mi taller: el del mecánico autenticado (o al que pidió sumarse) y su rol
create or replace function public.mi_taller()
returns table (
  id uuid, nombre text, descripcion text, telefono text, direccion text, localidad text,
  latitud double precision, longitud double precision, especialidades text[], imagen_url text, rol text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id, t.nombre, t.descripcion, t.telefono, t.direccion, t.localidad,
         t.latitud, t.longitud, t.especialidades, t.imagen_url,
         case when t.dueno_id = m.id then 'dueno'
              when m.taller_id = t.id then 'miembro'
              else 'pendiente' end
    from public.mecanicos m
    join public.talleres t on t.id = coalesce(m.taller_id, m.taller_pendiente_id)
   where m.usuario_id = auth.uid();
$$;

-- 5. Miembros del taller (los pendientes solo los ve el dueño)
create or replace function public.miembros_mi_taller()
returns table (mecanico_id uuid, nombre text, avatar_url text, telefono text, estado text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with yo as (
    select m.id, m.taller_id, (t.dueno_id = m.id) as es_dueno
      from public.mecanicos m
      join public.talleres t on t.id = m.taller_id
     where m.usuario_id = auth.uid()
  )
  select o.id,
         coalesce(nullif(btrim(p.nombre), ''), o.nombre),
         p.avatar_url,
         coalesce(o.telefono, p.telefono),
         case when t.dueno_id = o.id then 'dueno'
              when o.taller_id = yo.taller_id then 'miembro'
              else 'pendiente' end
    from yo
    join public.talleres t on t.id = yo.taller_id
    join public.mecanicos o on o.taller_id = yo.taller_id
                            or (yo.es_dueno and o.taller_pendiente_id = yo.taller_id)
    left join public.perfiles p on p.id = o.usuario_id
   order by 5 desc, 2;
$$;

-- Ayudante: el taller del que el usuario autenticado es dueño (o error).
create or replace function public.taller_del_dueno()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_taller uuid;
begin
  select t.id into v_taller
    from public.talleres t join public.mecanicos m on m.id = t.dueno_id
   where m.usuario_id = auth.uid();
  if v_taller is null then
    raise exception 'Solo el dueño del taller puede hacer esto.' using errcode = 'P0001';
  end if;
  return v_taller;
end;
$$;

-- 6. Editar el taller (solo el dueño)
create or replace function public.actualizar_mi_taller(
  p_nombre text,
  p_descripcion text,
  p_telefono text,
  p_direccion text,
  p_localidad text,
  p_latitud double precision,
  p_longitud double precision,
  p_especialidades text[],
  p_imagen_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_taller uuid := public.taller_del_dueno();
begin
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre del taller es obligatorio.' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_direccion, '')), '') is null or p_latitud is null or p_longitud is null then
    raise exception 'Marcá en el mapa dónde está el taller.' using errcode = 'P0001';
  end if;

  update public.talleres
     set nombre         = btrim(p_nombre),
         descripcion    = nullif(btrim(coalesce(p_descripcion, '')), ''),
         telefono       = nullif(btrim(coalesce(p_telefono, '')), ''),
         direccion      = btrim(p_direccion),
         localidad      = nullif(btrim(coalesce(p_localidad, '')), ''),
         latitud        = p_latitud,
         longitud       = p_longitud,
         especialidades = coalesce(p_especialidades, '{}'),
         imagen_url     = coalesce(p_imagen_url, imagen_url)
   where id = v_taller;
end;
$$;

-- 7. Aceptar o rechazar un pedido para sumarse (solo el dueño)
create or replace function public.responder_union_taller(p_mecanico_id uuid, p_aceptar boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_taller  uuid := public.taller_del_dueno();
  v_usuario uuid;
  v_nombre  text;
begin
  select m.usuario_id into v_usuario
    from public.mecanicos m
   where m.id = p_mecanico_id and m.taller_pendiente_id = v_taller;
  if not found then
    raise exception 'Ese pedido ya no está pendiente.' using errcode = 'P0001';
  end if;

  select nombre into v_nombre from public.talleres where id = v_taller;

  update public.mecanicos
     set taller_pendiente_id = null,
         taller_id = case when p_aceptar then v_taller else taller_id end
   where id = p_mecanico_id;

  if v_usuario is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, tipo)
    values (
      v_usuario,
      case when p_aceptar then 'Te aceptaron en ' || v_nombre else 'No te aceptaron en ' || v_nombre end,
      case when p_aceptar
           then 'Ya recibís los pedidos que le hagan al taller.'
           else 'Seguís trabajando en ruta. Podés hablar con el dueño del taller.' end,
      'taller'
    );
  end if;
end;
$$;

-- 8. Quitar a un miembro (solo el dueño, y no a sí mismo)
create or replace function public.quitar_miembro_taller(p_mecanico_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_taller uuid := public.taller_del_dueno();
begin
  if exists (select 1 from public.talleres where id = v_taller and dueno_id = p_mecanico_id) then
    raise exception 'No podés quitarte a vos mismo: sos el dueño del taller.' using errcode = 'P0001';
  end if;

  update public.mecanicos set taller_id = null where id = p_mecanico_id and taller_id = v_taller;
  if not found then
    raise exception 'Ese mecánico no es miembro de tu taller.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.mi_taller() from public, anon;
revoke execute on function public.miembros_mi_taller() from public, anon;
revoke execute on function public.taller_del_dueno() from public, anon;
revoke execute on function public.actualizar_mi_taller(text, text, text, text, text, double precision, double precision, text[], text) from public, anon;
revoke execute on function public.responder_union_taller(uuid, boolean) from public, anon;
revoke execute on function public.quitar_miembro_taller(uuid) from public, anon;
grant execute on function public.mi_taller() to authenticated;
grant execute on function public.miembros_mi_taller() to authenticated;
grant execute on function public.taller_del_dueno() to authenticated;
grant execute on function public.actualizar_mi_taller(text, text, text, text, text, double precision, double precision, text[], text) to authenticated;
grant execute on function public.responder_union_taller(uuid, boolean) to authenticated;
grant execute on function public.quitar_miembro_taller(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
