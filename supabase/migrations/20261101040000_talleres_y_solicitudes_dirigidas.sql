-- Talleres separados de los mecánicos y solicitudes dirigidas a un taller.
-- - `talleres`: el lugar físico (aparece en el mapa). Puede tener varios mecánicos
--   (`mecanicos.taller_id`) o ninguno: sin mecánicos es "no adherido" y solo se lo puede llamar.
-- - `mecanicos`: la persona con cuenta. Puede pertenecer a un taller o trabajar en ruta.
-- - Una solicitud pedida desde el modal de un taller (o de un mecánico en ruta) solo la ven
--   y la pueden aceptar los mecánicos de ese taller (o ese mecánico). Si nadie la acepta,
--   queda esperando: el cliente la puede cancelar y usar el SOS.
-- - En el registro, el mecánico crea su taller, se suma a uno existente o trabaja en ruta.

begin;

-- 1. Talleres
create table if not exists public.talleres (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (char_length(btrim(nombre)) > 0),
  descripcion    text,
  telefono       text,
  direccion      text not null,
  localidad      text,
  latitud        double precision not null,
  longitud       double precision not null,
  especialidades text[] not null default '{}',
  imagen_url     text,
  creado_en      timestamptz not null default now()
);

comment on table public.talleres is
  'Taller físico que aparece en el mapa. Sin mecánicos con cuenta es "no adherido": solo se lo puede llamar.';

alter table public.talleres enable row level security;

-- Datos públicos de un comercio: los ve cualquiera (el registro los lista antes de tener cuenta).
drop policy if exists "talleres: lectura pública" on public.talleres;
create policy "talleres: lectura pública"
  on public.talleres for select
  to anon, authenticated
  using (true);

grant select on public.talleres to anon, authenticated;

-- 2. Cada mecánico puede pertenecer a un taller
alter table public.mecanicos
  add column if not exists taller_id uuid references public.talleres (id) on delete set null;

create index if not exists mecanicos_taller_id_idx on public.mecanicos (taller_id);

comment on column public.mecanicos.taller_id is 'Taller al que pertenece; null si hace asistencia en ruta.';
comment on column public.mecanicos.nombre is 'Nombre de la persona (el del taller está en talleres.nombre).';

-- 3. Datos actuales: cada fila de mecanicos con dirección era un taller.
--    Se copia con el mismo id para no romper enlaces.
insert into public.talleres (id, nombre, descripcion, telefono, direccion, localidad, latitud, longitud, especialidades, imagen_url, creado_en)
select id, nombre, descripcion, telefono, direccion, localidad, latitud, longitud, especialidades, imagen_url, creado_en
  from public.mecanicos
 where direccion is not null and latitud is not null and longitud is not null
on conflict (id) do nothing;

-- El mecánico con cuenta que era su propio taller pasa a ser miembro de ese taller.
update public.mecanicos m
   set taller_id = m.id
 where m.usuario_id is not null
   and exists (select 1 from public.talleres t where t.id = m.id);

-- El nombre del mecánico pasa a ser el de la persona.
update public.mecanicos m
   set nombre = p.nombre
  from public.perfiles p
 where p.id = m.usuario_id
   and coalesce(btrim(p.nombre), '') <> '';

-- La ubicación del taller ya vive en talleres.
update public.mecanicos
   set direccion = null, latitud = null, longitud = null
 where taller_id is not null;

-- Los talleres cargados sin persona (seed) dejan de ser mecánicos: quedan como talleres no adheridos.
delete from public.mecanicos m
 where m.usuario_id is null
   and exists (select 1 from public.talleres t where t.id = m.id);

-- 4. Solicitud dirigida: a un taller o a un mecánico en ruta (nunca a los dos)
alter table public.solicitudes
  add column if not exists taller_solicitado_id uuid references public.talleres (id) on delete set null,
  add column if not exists mecanico_solicitado_id uuid references public.mecanicos (id) on delete set null;

comment on column public.solicitudes.taller_solicitado_id is
  'Taller elegido desde el mapa: solo sus mecánicos ven y aceptan la solicitud.';
comment on column public.solicitudes.mecanico_solicitado_id is
  'Mecánico en ruta elegido desde la lista: solo él ve y acepta la solicitud.';

grant insert (taller_solicitado_id, mecanico_solicitado_id) on public.solicitudes to authenticated;

-- El destino tiene que poder recibir pedidos: un taller con mecánicos o un mecánico con cuenta.
create or replace function public.fn_validar_destino_solicitud()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.taller_solicitado_id is not null and new.mecanico_solicitado_id is not null then
    raise exception 'La solicitud va a un taller o a un mecánico, no a los dos.' using errcode = 'P0001';
  end if;

  if new.taller_solicitado_id is not null and not exists (
    select 1 from public.mecanicos
     where taller_id = new.taller_solicitado_id and usuario_id is not null
  ) then
    raise exception 'Este taller todavía no recibe pedidos por la app. Podés llamarlo o usar el SOS.'
      using errcode = 'P0001';
  end if;

  if new.mecanico_solicitado_id is not null and not exists (
    select 1 from public.mecanicos
     where id = new.mecanico_solicitado_id and usuario_id is not null
  ) then
    raise exception 'Este mecánico todavía no recibe pedidos por la app. Podés llamarlo o usar el SOS.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validar_destino_solicitud on public.solicitudes;
create trigger trg_validar_destino_solicitud
  before insert on public.solicitudes
  for each row execute function public.fn_validar_destino_solicitud();

-- ¿El usuario autenticado es destinatario de una solicitud? Sin destino, la ven todos.
create or replace function public.es_destinatario_solicitud(p_taller uuid, p_mecanico uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when p_taller is not null then exists (
      select 1 from public.mecanicos where usuario_id = auth.uid() and taller_id = p_taller)
    when p_mecanico is not null then exists (
      select 1 from public.mecanicos where usuario_id = auth.uid() and id = p_mecanico)
    else true
  end;
$$;

drop policy if exists "solicitudes: pendientes para mecánicos disponibles" on public.solicitudes;
create policy "solicitudes: pendientes para mecánicos disponibles"
  on public.solicitudes for select to authenticated
  using (
    estado = 'pendiente'
    and mecanico_id is null
    and exists (select 1 from public.mecanicos where usuario_id = auth.uid() and disponible)
    and public.es_destinatario_solicitud(taller_solicitado_id, mecanico_solicitado_id)
  );

-- 5. Aceptar: una solicitud dirigida solo la acepta su destinatario
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

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id;
  if v_solicitud.taller_solicitado_id is not null
     and v_solicitud.taller_solicitado_id is distinct from v_mecanico.taller_id then
    raise exception 'Esta solicitud se pidió a otro taller.' using errcode = 'P0001';
  end if;
  if v_solicitud.mecanico_solicitado_id is not null
     and v_solicitud.mecanico_solicitado_id <> v_mecanico.id then
    raise exception 'Esta solicitud se pidió a otro mecánico.' using errcode = 'P0001';
  end if;

  -- La condición "mecanico_id is null" dentro del UPDATE hace que, ante dos
  -- aceptaciones simultáneas, solo una prospere (RN-002, RN-003).
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

-- 6. Resumen de cada taller: estrellas de sus mecánicos y cuántos reciben pedidos
create or replace function public.resumen_talleres()
returns table (taller_id uuid, promedio numeric, cantidad integer, mecanicos integer, disponibles integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id,
         (select round(avg(c.puntaje), 1)
            from public.calificaciones c join public.mecanicos m on m.id = c.mecanico_id
           where m.taller_id = t.id),
         (select count(*)::integer
            from public.calificaciones c join public.mecanicos m on m.id = c.mecanico_id
           where m.taller_id = t.id),
         (select count(*)::integer from public.mecanicos m
           where m.taller_id = t.id and m.usuario_id is not null),
         (select count(*)::integer from public.mecanicos m
           where m.taller_id = t.id and m.usuario_id is not null and m.disponible)
    from public.talleres t;
$$;

-- 7. Registro: el mecánico crea su taller, se suma a uno existente o trabaja en ruta
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
  v_taller uuid;
  v_especialidades text[] := case
    when jsonb_typeof(meta -> 'taller_especialidades') = 'array'
      then array(select jsonb_array_elements_text(meta -> 'taller_especialidades'))
    else '{}'::text[]
  end;
begin
  insert into public.perfiles (id, nombre, telefono)
  values (
    new.id,
    coalesce(meta ->> 'nombre', ''),
    nullif(meta ->> 'telefono', '')
  )
  on conflict (id) do nothing;

  if meta ->> 'rol' = 'mecanico' then
    if modo = 'existente' and coalesce(meta ->> 'taller_id', '') ~* '^[0-9a-f-]{36}$' then
      select id into v_taller from public.talleres where id = (meta ->> 'taller_id')::uuid;
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
    end if;

    insert into public.mecanicos (usuario_id, nombre, descripcion, telefono, localidad, especialidades, disponible, taller_id)
    values (
      new.id,
      coalesce(nullif(btrim(meta ->> 'nombre'), ''), 'Mecánico'),
      nullif(meta ->> 'taller_descripcion', ''),
      nullif(meta ->> 'telefono', ''),
      nullif(meta ->> 'taller_ubicacion', ''),
      v_especialidades,
      true,
      v_taller
    )
    on conflict (usuario_id) do nothing;
  end if;

  return new;
end;
$function$;

revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;
revoke execute on function public.fn_validar_destino_solicitud() from public, anon, authenticated;
revoke execute on function public.es_destinatario_solicitud(uuid, uuid) from public, anon;
revoke execute on function public.resumen_talleres() from public, anon;
grant execute on function public.es_destinatario_solicitud(uuid, uuid) to authenticated;
grant execute on function public.resumen_talleres() to authenticated;

commit;

notify pgrst, 'reload schema';
