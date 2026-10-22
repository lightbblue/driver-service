-- =============================================================================
-- Etapa 2.1 — perfiles, mecanicos, especialidades, mecanico_especialidades
-- Modelo de datos: 03-Rider-Service-Modelo-de-Datos.md, secciones 3, 4, 10.5 y 11.
--
-- El proyecto ya tenía `perfiles` (id, nombre, telefono, avatar_url, creado_en) y
-- `mecanicos` (id, nombre, telefono, descripcion, localidad, latitud, longitud,
-- disponible, creado_en). Esta migración las lleva al modelo sin perder datos.
-- Es idempotente: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
--  EXTENSIONES Y TIPOS
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists citext with schema extensions;

do $$
begin
  if to_regtype('public.rol_usuario') is null then
    create type public.rol_usuario as enum ('cliente', 'mecanico', 'admin');
  end if;
end $$;

-- Utilidad: 'actualizado_en' automático (sección 10.5).
create or replace function public.fn_touch()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- Nombre y teléfono que cumplen las restricciones de `perfiles`.
create or replace function public.normalizar_nombre(p_nombre text, p_email text)
returns text
language sql
immutable
as $$
  select case
    when length(btrim(coalesce(p_nombre, ''))) >= 3 then btrim(p_nombre)
    when length(split_part(coalesce(p_email, ''), '@', 1)) >= 3 then split_part(p_email, '@', 1)
    else 'Usuario'
  end;
$$;

create or replace function public.normalizar_telefono(p_telefono text)
returns text
language sql
immutable
as $$
  select case when btrim(p_telefono) ~ '^\+?[0-9\s\-()]{8,20}$' then btrim(p_telefono) end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
--  PERFILES
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.perfiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nombre_completo       text        not null,
  email                 extensions.citext not null,
  telefono              text,
  rol                   public.rol_usuario not null default 'cliente',
  avatar_url            text,
  localidad             text,
  provincia             text,
  latitud               numeric(9,6),
  longitud              numeric(9,6),
  terminos_aceptados_en timestamptz,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  eliminado_en          timestamptz
);

-- La tabla previa usaba `nombre`.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'perfiles' and column_name = 'nombre')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'perfiles' and column_name = 'nombre_completo') then
    alter table public.perfiles rename column nombre to nombre_completo;
  end if;
end $$;

alter table public.perfiles
  add column if not exists nombre_completo       text,
  add column if not exists email                 extensions.citext,
  add column if not exists telefono              text,
  add column if not exists rol                   public.rol_usuario not null default 'cliente',
  add column if not exists avatar_url            text,
  add column if not exists localidad             text,
  add column if not exists provincia             text,
  add column if not exists latitud               numeric(9,6),
  add column if not exists longitud              numeric(9,6),
  add column if not exists terminos_aceptados_en timestamptz,
  add column if not exists creado_en             timestamptz not null default now(),
  add column if not exists actualizado_en        timestamptz not null default now(),
  add column if not exists eliminado_en          timestamptz;

-- Perfil para cada usuario de Auth que todavía no lo tenga.
insert into public.perfiles (id, nombre_completo, email, telefono)
select u.id,
       public.normalizar_nombre(coalesce(u.raw_user_meta_data ->> 'nombre_completo', u.raw_user_meta_data ->> 'nombre'), u.email),
       coalesce(u.email, u.id::text),
       public.normalizar_telefono(u.raw_user_meta_data ->> 'telefono')
from auth.users u
where not exists (select 1 from public.perfiles p where p.id = u.id);

-- Completa los perfiles previos: email desde Auth y nombre válido.
update public.perfiles p
set email = coalesce(u.email, p.id::text)
from auth.users u
where u.id = p.id and p.email is null;

update public.perfiles
set email = id::text
where email is null;

update public.perfiles
set nombre_completo = public.normalizar_nombre(nombre_completo, email::text)
where nombre_completo is null or length(btrim(nombre_completo)) < 3;

alter table public.perfiles
  alter column nombre_completo set not null,
  alter column email set not null;

alter table public.perfiles
  drop constraint if exists perfiles_nombre_completo_check,
  drop constraint if exists perfiles_telefono_check,
  drop constraint if exists perfiles_latitud_check,
  drop constraint if exists perfiles_longitud_check,
  drop constraint if exists perfiles_email_key;

alter table public.perfiles
  add constraint perfiles_nombre_completo_check check (length(btrim(nombre_completo)) >= 3),
  add constraint perfiles_latitud_check  check (latitud between -90 and 90),
  add constraint perfiles_longitud_check check (longitud between -180 and 180),
  add constraint perfiles_email_key unique (email);

-- NOT VALID: se exige a los datos nuevos sin rechazar teléfonos que ya estaban cargados.
alter table public.perfiles
  add constraint perfiles_telefono_check
  check (telefono ~ '^\+?[0-9\s\-()]{8,20}$') not valid;

-- Clave foránea a auth.users, si la tabla previa no la tenía.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfiles'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.perfiles
      add constraint perfiles_id_fkey foreign key (id) references auth.users (id) on delete cascade not valid;
  end if;
end $$;

comment on table public.perfiles is
  'Extiende auth.users con datos del dominio. Las credenciales viven en auth, nunca aquí.';

create index if not exists idx_perfiles_rol       on public.perfiles (rol) where eliminado_en is null;
create index if not exists idx_perfiles_localidad on public.perfiles (localidad);

drop trigger if exists trg_touch_perfiles on public.perfiles;
create trigger trg_touch_perfiles
  before update on public.perfiles
  for each row execute function public.fn_touch();

-- ── Alta automática del perfil al registrarse (sección 13) ──────────────────
-- El rol NO se toma de los metadatos: el usuario no puede elegirse mecánico ni admin.
create or replace function public.fn_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, email, telefono)
  values (
    new.id,
    public.normalizar_nombre(coalesce(new.raw_user_meta_data ->> 'nombre_completo', new.raw_user_meta_data ->> 'nombre'), new.email),
    coalesce(new.email, new.id::text),
    public.normalizar_telefono(new.raw_user_meta_data ->> 'telefono')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Un trigger previo que insertaba en `perfiles` con las columnas viejas haría
-- fallar el registro: se reemplaza por el nuevo.
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc f on f.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgname <> 'trg_crear_perfil'
      and f.prosrc ilike '%perfiles%'
  loop
    execute format('drop trigger %I on auth.users', r.tgname);
    raise notice 'Trigger previo reemplazado en auth.users: %', r.tgname;
  end loop;
end $$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.fn_crear_perfil();

-- ═════════════════════════════════════════════════════════════════════════════
--  MECÁNICOS  (1:1 opcional con perfiles)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.mecanicos (
  id                      uuid primary key default gen_random_uuid(),
  perfil_id               uuid not null unique references public.perfiles (id) on delete cascade,
  nombre_taller           text,
  descripcion             text,
  logo_url                text,
  direccion_taller        text        not null,
  localidad               text        not null,
  latitud                 numeric(9,6) not null,
  longitud                numeric(9,6) not null,
  radio_cobertura_km      numeric(5,2) not null default 15,
  atiende_a_domicilio     boolean     not null default true,
  disponible              boolean     not null default false,
  verificado              boolean     not null default false,
  calificacion_promedio   numeric(3,2) not null default 0,
  cantidad_calificaciones integer     not null default 0,
  servicios_completados   integer     not null default 0,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  eliminado_en            timestamptz
);

-- La tabla previa usaba `nombre` para el taller.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mecanicos' and column_name = 'nombre')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mecanicos' and column_name = 'nombre_taller') then
    alter table public.mecanicos rename column nombre to nombre_taller;
  end if;
end $$;

alter table public.mecanicos
  add column if not exists perfil_id               uuid,
  add column if not exists nombre_taller           text,
  add column if not exists descripcion             text,
  add column if not exists logo_url                text,
  add column if not exists direccion_taller        text,
  add column if not exists localidad               text,
  add column if not exists latitud                 numeric(9,6),
  add column if not exists longitud                numeric(9,6),
  add column if not exists radio_cobertura_km      numeric(5,2) not null default 15,
  add column if not exists atiende_a_domicilio     boolean not null default true,
  add column if not exists disponible              boolean not null default false,
  add column if not exists verificado              boolean not null default false,
  add column if not exists calificacion_promedio   numeric(3,2) not null default 0,
  add column if not exists cantidad_calificaciones integer not null default 0,
  add column if not exists servicios_completados   integer not null default 0,
  add column if not exists creado_en               timestamptz not null default now(),
  add column if not exists actualizado_en          timestamptz not null default now(),
  add column if not exists eliminado_en            timestamptz;

alter table public.mecanicos
  alter column id         set default gen_random_uuid(),
  alter column latitud    type numeric(9,6),
  alter column longitud   type numeric(9,6),
  alter column disponible set default false;

update public.mecanicos set disponible = false where disponible is null;
alter table public.mecanicos alter column disponible set not null;

-- Si un taller previo usaba el id del usuario como id propio, se vincula.
update public.mecanicos m
set perfil_id = m.id
where m.perfil_id is null
  and exists (select 1 from public.perfiles p where p.id = m.id);

alter table public.mecanicos
  drop constraint if exists mecanicos_perfil_id_fkey,
  drop constraint if exists mecanicos_perfil_id_key,
  drop constraint if exists mecanicos_radio_cobertura_km_check,
  drop constraint if exists mecanicos_calificacion_promedio_check,
  drop constraint if exists mecanicos_cantidad_calificaciones_check;

alter table public.mecanicos
  add constraint mecanicos_perfil_id_fkey foreign key (perfil_id) references public.perfiles (id) on delete cascade,
  add constraint mecanicos_perfil_id_key unique (perfil_id),
  add constraint mecanicos_radio_cobertura_km_check check (radio_cobertura_km > 0),
  add constraint mecanicos_calificacion_promedio_check check (calificacion_promedio between 0 and 5),
  add constraint mecanicos_cantidad_calificaciones_check check (cantidad_calificaciones >= 0);

-- Columnas NOT NULL del modelo: se exigen solo si los datos previos ya las cumplen.
do $$
declare
  columna text;
  faltantes bigint;
begin
  foreach columna in array array['perfil_id', 'direccion_taller', 'localidad', 'latitud', 'longitud'] loop
    execute format('select count(*) from public.mecanicos where %I is null', columna) into faltantes;
    if faltantes = 0 then
      execute format('alter table public.mecanicos alter column %I set not null', columna);
    else
      raise notice 'mecanicos.%: % fila(s) sin dato. Completalas y volvé a correr esta migración para exigir NOT NULL.',
        columna, faltantes;
    end if;
  end loop;
end $$;

comment on column public.mecanicos.calificacion_promedio is
  'Desnormalizado a propósito: se recalcula por trigger al insertar una calificación (RF-RATING-002).';

create index if not exists idx_mecanicos_disponible on public.mecanicos (disponible)
  where disponible = true and eliminado_en is null;
create index if not exists idx_mecanicos_geo       on public.mecanicos (latitud, longitud);
create index if not exists idx_mecanicos_localidad on public.mecanicos (localidad);

drop trigger if exists trg_touch_mecanicos on public.mecanicos;
create trigger trg_touch_mecanicos
  before update on public.mecanicos
  for each row execute function public.fn_touch();

-- El perfil vinculado a un taller tiene rol de mecánico.
create or replace function public.fn_sincronizar_rol_mecanico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.perfil_id is not null then
    update public.perfiles set rol = 'mecanico'
    where id = new.perfil_id and rol = 'cliente';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rol_mecanico on public.mecanicos;
create trigger trg_rol_mecanico
  after insert or update of perfil_id on public.mecanicos
  for each row execute function public.fn_sincronizar_rol_mecanico();

update public.perfiles set rol = 'mecanico'
where rol = 'cliente' and id in (select perfil_id from public.mecanicos where perfil_id is not null);

-- ═════════════════════════════════════════════════════════════════════════════
--  ESPECIALIDADES  (catálogo extensible — RNF-SCAL-002)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.especialidades (
  id      uuid primary key default gen_random_uuid(),
  codigo  text not null unique,
  nombre  text not null,
  icono   text,
  activo  boolean not null default true,
  orden   integer not null default 0
);

create table if not exists public.mecanico_especialidades (
  mecanico_id     uuid not null references public.mecanicos (id)      on delete cascade,
  especialidad_id uuid not null references public.especialidades (id) on delete restrict,
  primary key (mecanico_id, especialidad_id)
);

insert into public.especialidades (codigo, nombre, orden) values
  ('MOTOS',         'Motos',            1),
  ('ELECTRICA',     'Eléctrica',        2),
  ('NEUMATICOS',    'Neumáticos',       3),
  ('A_DOMICILIO',   'A domicilio',      4),
  ('MECANICA_GRAL', 'Mecánica general', 5),
  ('EMERGENCIAS',   'Emergencias',      6)
on conflict (codigo) do nothing;

-- ═════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (sección 11)
--  Se eliminan las políticas previas de estas tablas: rige solo el conjunto del modelo.
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('perfiles', 'mecanicos', 'especialidades', 'mecanico_especialidades')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.perfiles                enable row level security;
alter table public.mecanicos               enable row level security;
alter table public.especialidades          enable row level security;
alter table public.mecanico_especialidades enable row level security;

-- Privilegios por columna: el usuario edita sus datos, pero no su rol, su
-- email (lo gestiona Auth) ni las métricas o la verificación de su taller.
revoke all on public.perfiles, public.mecanicos, public.especialidades, public.mecanico_especialidades from anon;
revoke insert, update, delete on public.perfiles from authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre_completo, telefono, avatar_url, localidad, provincia, latitud, longitud, terminos_aceptados_en)
  on public.perfiles to authenticated;

revoke insert, update, delete on public.mecanicos from authenticated;
grant select on public.mecanicos to authenticated;
grant insert (perfil_id, nombre_taller, descripcion, logo_url, direccion_taller, localidad,
              latitud, longitud, radio_cobertura_km, atiende_a_domicilio, disponible)
  on public.mecanicos to authenticated;
grant update (nombre_taller, descripcion, logo_url, direccion_taller, localidad,
              latitud, longitud, radio_cobertura_km, atiende_a_domicilio, disponible)
  on public.mecanicos to authenticated;

revoke insert, update, delete on public.especialidades from authenticated;
grant select on public.especialidades to authenticated;
grant select, insert, delete on public.mecanico_especialidades to authenticated;

-- ── PERFILES ──
create policy "perfil propio: lectura"
  on public.perfiles for select to authenticated
  using (id = auth.uid());

create policy "perfil propio: actualización"
  on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "perfiles de mecánicos: lectura pública"
  on public.perfiles for select to authenticated
  using (rol = 'mecanico' and eliminado_en is null);

-- ── MECÁNICOS ──
create policy "mecánicos: lectura para autenticados"
  on public.mecanicos for select to authenticated
  using (eliminado_en is null);

create policy "mecánico: crea su propia ficha"
  on public.mecanicos for insert to authenticated
  with check (perfil_id = auth.uid());

create policy "mecánico: actualiza su propia ficha"
  on public.mecanicos for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- ── ESPECIALIDADES ──
create policy "especialidades: lectura para autenticados"
  on public.especialidades for select to authenticated
  using (activo);

create policy "especialidades del mecánico: lectura"
  on public.mecanico_especialidades for select to authenticated
  using (true);

create policy "especialidades del mecánico: las gestiona el propio mecánico"
  on public.mecanico_especialidades for insert to authenticated
  with check (mecanico_id in (select id from public.mecanicos where perfil_id = auth.uid()));

create policy "especialidades del mecánico: las quita el propio mecánico"
  on public.mecanico_especialidades for delete to authenticated
  using (mecanico_id in (select id from public.mecanicos where perfil_id = auth.uid()));

commit;

notify pgrst, 'reload schema';
