-- =============================================================================
-- Etapa 2.2 — categorias_averia, servicios, servicio_estados + máquina de estados
-- Modelo de datos: 03-Rider-Service-Modelo-de-Datos.md, secciones 3, 5, 10, 11 y 16.
--
-- Requiere la etapa 2.1. Es idempotente: se puede ejecutar más de una vez.
-- =============================================================================

begin;

do $$
begin
  if to_regtype('public.estado_servicio') is null then
    create type public.estado_servicio as enum (
      'solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'cancelada'
    );
  end if;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  CATEGORÍAS DE AVERÍA  (catálogo — RF-ASSIST-002)
--  La tabla previa no tenía `codigo`, `requiere_foto`, `activo` ni `orden`.
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.categorias_averia (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nombre        text not null,
  descripcion   text,
  icono         text,
  requiere_foto boolean not null default false,
  activo        boolean not null default true,
  orden         integer not null default 0
);

alter table public.categorias_averia
  add column if not exists codigo        text,
  add column if not exists requiere_foto boolean not null default false,
  add column if not exists activo        boolean not null default true,
  add column if not exists orden         integer not null default 0;

-- Código y orden de las categorías ya cargadas, reconocidas por su ícono.
update public.categorias_averia c
set codigo = m.codigo,
    orden  = m.orden
from (values
  ('engine',  'FALLA_MECANICA',  1),
  ('tire',    'PINCHADURA',      2),
  ('battery', 'BATERIA',         3),
  ('fuel',    'SIN_COMBUSTIBLE', 4),
  ('key',     'ARRANQUE',        5),
  ('chain',   'CADENA',          6),
  ('crash',   'ACCIDENTE',       7),
  ('alert',   'OTRO',            8)
) as m (icono, codigo, orden)
where c.codigo is null
  and c.icono = m.icono
  and not exists (select 1 from public.categorias_averia x where x.codigo = m.codigo);

update public.categorias_averia
set codigo = 'CATEGORIA_' || upper(left(id::text, 8))
where codigo is null;

alter table public.categorias_averia alter column codigo set not null;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.categorias_averia'::regclass and conname = 'categorias_averia_codigo_key') then
    alter table public.categorias_averia add constraint categorias_averia_codigo_key unique (codigo);
  end if;
end $$;

insert into public.categorias_averia (codigo, nombre, icono, orden) values
  ('FALLA_MECANICA',  'Falla mecánica',        'engine',  1),
  ('PINCHADURA',      'Pinchadura',            'tire',    2),
  ('BATERIA',         'Batería descargada',    'battery', 3),
  ('SIN_COMBUSTIBLE', 'Sin combustible',       'fuel',    4),
  ('ARRANQUE',        'Problemas de arranque', 'key',     5),
  ('CADENA',          'Problemas de cadena',   'chain',   6),
  ('ACCIDENTE',       'Accidente',             'crash',   7),
  ('OTRO',            'Otro problema',         'alert',   8)
on conflict (codigo) do nothing;

update public.categorias_averia set requiere_foto = true where codigo = 'ACCIDENTE';

-- ═════════════════════════════════════════════════════════════════════════════
--  SERVICIOS  (entidad central)
-- ═════════════════════════════════════════════════════════════════════════════
create sequence if not exists public.seq_servicio_codigo;

create table if not exists public.servicios (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  cliente_id         uuid not null default auth.uid() references public.perfiles (id) on delete restrict,
  mecanico_id        uuid references public.mecanicos (id) on delete set null,
  -- La FK a `motocicletas` se agrega en la etapa 2.3, cuando exista la tabla.
  motocicleta_id     uuid,
  categoria_id       uuid not null references public.categorias_averia (id) on delete restrict,

  descripcion        text check (length(descripcion) <= 200),

  latitud            numeric(9,6) not null check (latitud between -90 and 90),
  longitud           numeric(9,6) not null check (longitud between -180 and 180),
  direccion          text not null check (length(btrim(direccion)) > 0),
  localidad          text,
  referencia         text,

  estado             public.estado_servicio not null default 'solicitado',
  eta_minutos        integer check (eta_minutos >= 0),
  requiere_traslado  boolean not null default false,

  creado_en          timestamptz not null default now(),
  aceptado_en        timestamptz,
  en_camino_en       timestamptz,
  llegada_en         timestamptz,
  inicio_trabajo_en  timestamptz,
  finalizado_en      timestamptz,
  cancelado_en       timestamptz,
  motivo_cancelacion text,
  actualizado_en     timestamptz not null default now(),

  constraint chk_asignacion_coherente check (
    (mecanico_id is null and aceptado_en is null) or
    (mecanico_id is not null and aceptado_en is not null)
  ),
  constraint chk_finalizacion_coherente check ((estado <> 'finalizado') or (finalizado_en is not null)),
  constraint chk_cancelacion_coherente  check ((estado <> 'cancelada')  or (cancelado_en  is not null))
);

comment on table public.servicios is
  'Entidad central. El estado se modifica exclusivamente mediante la función cambiar_estado_servicio().';

create index if not exists idx_servicios_cliente  on public.servicios (cliente_id, creado_en desc);
create index if not exists idx_servicios_mecanico on public.servicios (mecanico_id, creado_en desc);
create index if not exists idx_servicios_estado   on public.servicios (estado);
create index if not exists idx_servicios_geo      on public.servicios (latitud, longitud);

-- RN-010: un cliente no puede tener más de una solicitud activa.
create unique index if not exists uq_servicio_activo_por_cliente on public.servicios (cliente_id)
  where estado in ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando');

-- Un mecánico no puede estar en dos servicios en curso a la vez.
create unique index if not exists uq_servicio_activo_por_mecanico on public.servicios (mecanico_id)
  where mecanico_id is not null and estado in ('aceptado', 'en_camino', 'llegue', 'trabajando');

-- ═════════════════════════════════════════════════════════════════════════════
--  HISTORIAL DE ESTADOS  (RF-DATA-004 — bitácora inmutable)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.servicio_estados (
  id              bigint generated always as identity primary key,
  servicio_id     uuid not null references public.servicios (id) on delete cascade,
  estado_anterior public.estado_servicio,
  estado_nuevo    public.estado_servicio not null,
  actor_id        uuid references public.perfiles (id) on delete set null,
  latitud         numeric(9,6),
  longitud        numeric(9,6),
  observacion     text,
  ocurrido_en     timestamptz not null default now()
);

comment on table public.servicio_estados is
  'Bitácora de solo inserción. No se actualiza ni se borra: es la evidencia de trazabilidad.';

create index if not exists idx_servicio_estados on public.servicio_estados (servicio_id, ocurrido_en);

-- ═════════════════════════════════════════════════════════════════════════════
--  LÓGICA DE NEGOCIO (sección 10)
-- ═════════════════════════════════════════════════════════════════════════════

-- Código legible: RS-2026-0013.
create or replace function public.fn_codigo_servicio()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null then
    new.codigo := 'RS-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('public.seq_servicio_codigo')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_codigo_servicio on public.servicios;
create trigger trg_codigo_servicio
  before insert on public.servicios
  for each row execute function public.fn_codigo_servicio();

-- RN-004: transiciones válidas.
create or replace function public.transicion_valida(p_desde public.estado_servicio, p_hasta public.estado_servicio)
returns boolean
language sql
immutable
as $$
  select case p_desde
    when 'solicitado' then p_hasta in ('aceptado', 'cancelada')
    when 'aceptado'   then p_hasta in ('en_camino', 'cancelada')
    when 'en_camino'  then p_hasta in ('llegue', 'cancelada')
    when 'llegue'     then p_hasta in ('trabajando', 'cancelada')
    when 'trabajando' then p_hasta in ('finalizado')
    when 'finalizado' then false
    when 'cancelada'  then false
  end;
$$;

-- Valida la transición, completa las marcas temporales y escribe la bitácora.
-- La observación llega desde cambiar_estado_servicio() en la variable de
-- transacción `rider.observacion`.
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
      raise exception 'Transición inválida: % → %', old.estado, new.estado using errcode = 'P0003';
    end if;

    case new.estado
      when 'aceptado'   then new.aceptado_en       := coalesce(new.aceptado_en, now());
      when 'en_camino'  then new.en_camino_en      := now();
      when 'llegue'     then new.llegada_en        := now();
      when 'trabajando' then new.inicio_trabajo_en := now();
      when 'finalizado' then new.finalizado_en     := now();
      when 'cancelada'  then new.cancelado_en      := now();
      else null;
    end case;

    insert into public.servicio_estados (servicio_id, estado_anterior, estado_nuevo, actor_id, observacion)
    values (new.id, old.estado, new.estado, auth.uid(),
            nullif(current_setting('rider.observacion', true), ''));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_transicion on public.servicios;
create trigger trg_validar_transicion
  before update on public.servicios
  for each row execute function public.fn_validar_transicion();

-- La bitácora también registra el alta de la solicitud.
create or replace function public.fn_registrar_estado_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.servicio_estados (servicio_id, estado_anterior, estado_nuevo, actor_id, latitud, longitud)
  values (new.id, null, new.estado, new.cliente_id, new.latitud, new.longitud);
  return new;
end;
$$;

drop trigger if exists trg_estado_inicial on public.servicios;
create trigger trg_estado_inicial
  after insert on public.servicios
  for each row execute function public.fn_registrar_estado_inicial();

-- ── Funciones auxiliares de seguridad (sección 11) ──────────────────────────
create or replace function public.mecanico_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.mecanicos
  where perfil_id = auth.uid() and eliminado_en is null
  limit 1;
$$;

create or replace function public.es_mecanico_de(p_servicio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.servicios s
    join public.mecanicos m on m.id = s.mecanico_id
    where s.id = p_servicio_id and m.perfil_id = auth.uid()
  );
$$;

create or replace function public.es_cliente_de(p_servicio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.servicios where id = p_servicio_id and cliente_id = auth.uid()
  );
$$;

-- ── 10.1 Asignación atómica (RN-002, RF-MATCH-004) ──────────────────────────
-- El mecánico sale de la sesión, no de un parámetro: nadie puede aceptar en
-- nombre de otro.
create or replace function public.aceptar_servicio(p_servicio_id uuid, p_eta_minutos integer default null)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio   public.servicios;
  v_mecanico   public.mecanicos;
begin
  select * into v_mecanico from public.mecanicos
  where perfil_id = auth.uid() and eliminado_en is null;

  if v_mecanico.id is null then
    raise exception 'Solo un mecánico puede aceptar una solicitud.' using errcode = 'P0001';
  end if;

  if not v_mecanico.disponible then
    raise exception 'El mecánico no se encuentra disponible' using errcode = 'P0001';
  end if;

  update public.servicios
     set mecanico_id = v_mecanico.id,
         estado      = 'aceptado',
         aceptado_en = now(),
         eta_minutos = p_eta_minutos
   where id = p_servicio_id
     and mecanico_id is null
     and estado = 'solicitado'
  returning * into v_servicio;

  if v_servicio.id is null then
    raise exception 'El servicio ya fue asignado a otro mecánico' using errcode = 'P0002';
  end if;

  return v_servicio;
end;
$$;

-- ── Cambio de estado: única vía para modificar un servicio ──────────────────
-- Decide quién puede pedir cada cambio; la validez de la transición, las
-- marcas temporales y la bitácora quedan a cargo de trg_validar_transicion.
create or replace function public.cambiar_estado_servicio(
  p_servicio_id uuid,
  p_estado      public.estado_servicio,
  p_observacion text    default null,
  p_eta_minutos integer default null
)
returns public.servicios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio    public.servicios;
  v_obs         text := nullif(btrim(coalesce(p_observacion, '')), '');
  v_es_cliente  boolean;
  v_es_asignado boolean;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  perform set_config('rider.observacion', coalesce(v_obs, ''), true);

  if p_estado = 'aceptado' then
    return public.aceptar_servicio(p_servicio_id, p_eta_minutos);
  end if;

  select * into v_servicio from public.servicios where id = p_servicio_id for update;
  if v_servicio.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  v_es_cliente  := v_servicio.cliente_id = auth.uid();
  v_es_asignado := public.es_mecanico_de(p_servicio_id);

  if p_estado = 'cancelada' then
    if not (v_es_cliente or v_es_asignado) then
      raise exception 'No tenés permiso para cancelar esta solicitud.' using errcode = 'P0001';
    end if;
    -- Con un mecánico ya involucrado, la cancelación debe explicarse.
    if v_obs is null and v_servicio.mecanico_id is not null then
      raise exception 'Indicá el motivo de la cancelación.' using errcode = 'P0001';
    end if;

    update public.servicios
       set estado = 'cancelada', motivo_cancelacion = v_obs, eta_minutos = null
     where id = p_servicio_id
    returning * into v_servicio;
    return v_servicio;
  end if;

  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  update public.servicios
     set estado      = p_estado,
         eta_minutos = case
                         when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos)
                         else null
                       end
   where id = p_servicio_id
  returning * into v_servicio;

  if p_estado = 'finalizado' then
    update public.mecanicos
       set servicios_completados = servicios_completados + 1
     where id = v_servicio.mecanico_id;
  end if;

  return v_servicio;
end;
$$;

-- ── Utilidades geográficas (sección 10.5, RF-MATCH-001) ─────────────────────
create or replace function public.distancia_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric
language sql
immutable
as $$
  select round((
    6371 * acos(
      least(1, greatest(-1,
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1))
        + sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  )::numeric, 2);
$$;

create or replace function public.mecanicos_cercanos(p_lat numeric, p_lon numeric, p_radio_km numeric default 15)
returns table (mecanico_id uuid, nombre_taller text, distancia numeric, calificacion numeric, especialidades text[])
language sql
stable
as $$
  select m.id,
         m.nombre_taller,
         public.distancia_km(p_lat, p_lon, m.latitud, m.longitud) as distancia,
         m.calificacion_promedio,
         array_remove(array_agg(e.nombre), null)
    from public.mecanicos m
    left join public.mecanico_especialidades me on me.mecanico_id = m.id
    left join public.especialidades e           on e.id = me.especialidad_id
   where m.disponible = true
     and m.eliminado_en is null
     and public.distancia_km(p_lat, p_lon, m.latitud, m.longitud) <= least(p_radio_km, m.radio_cobertura_km)
   group by m.id
   order by distancia asc;
$$;

revoke all on function public.aceptar_servicio(uuid, integer) from public, anon;
revoke all on function public.cambiar_estado_servicio(uuid, public.estado_servicio, text, integer) from public, anon;
revoke all on function public.mecanico_id_actual() from public, anon;
revoke all on function public.mecanicos_cercanos(numeric, numeric, numeric) from public, anon;
revoke all on function public.fn_validar_transicion() from public, anon, authenticated;
revoke all on function public.fn_registrar_estado_inicial() from public, anon, authenticated;
grant execute on function public.aceptar_servicio(uuid, integer) to authenticated;
grant execute on function public.cambiar_estado_servicio(uuid, public.estado_servicio, text, integer) to authenticated;
grant execute on function public.mecanico_id_actual() to authenticated;
grant execute on function public.mecanicos_cercanos(numeric, numeric, numeric) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (sección 11)
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('categorias_averia', 'servicios', 'servicio_estados')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.categorias_averia enable row level security;
alter table public.servicios         enable row level security;
alter table public.servicio_estados  enable row level security;

-- El cliente solo puede cargar los datos de su pedido: código, estado, mecánico
-- y marcas temporales los pone la base. Nadie actualiza ni borra de forma directa.
revoke all on public.servicios, public.servicio_estados from anon;
revoke insert, update, delete on public.servicios from authenticated;
revoke insert, update, delete on public.servicio_estados from authenticated;
grant select on public.servicios, public.servicio_estados to authenticated;
grant insert (cliente_id, motocicleta_id, categoria_id, descripcion, latitud, longitud, direccion, localidad, referencia)
  on public.servicios to authenticated;

revoke insert, update, delete on public.categorias_averia from anon, authenticated;
grant select on public.categorias_averia to anon, authenticated;

create policy "categorías: catálogo público"
  on public.categorias_averia for select to anon, authenticated
  using (activo);

create policy "servicio: lo ve el cliente o el mecánico asignado"
  on public.servicios for select to authenticated
  using (cliente_id = auth.uid() or mecanico_id = public.mecanico_id_actual());

create policy "servicio: solicitudes abiertas visibles para mecánicos disponibles"
  on public.servicios for select to authenticated
  using (
    estado = 'solicitado'
    and mecanico_id is null
    and exists (select 1 from public.mecanicos
                where perfil_id = auth.uid() and disponible = true and eliminado_en is null)
  );

create policy "servicio: solo el cliente crea su solicitud"
  on public.servicios for insert to authenticated
  with check (cliente_id = auth.uid());

create policy "historial: visible para los participantes"
  on public.servicio_estados for select to authenticated
  using (public.es_cliente_de(servicio_id) or public.es_mecanico_de(servicio_id));

-- ═════════════════════════════════════════════════════════════════════════════
--  REALTIME (sección 16): solo servicios y su historial
-- ═════════════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'servicios') then
    alter publication supabase_realtime add table public.servicios;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'servicio_estados') then
    alter publication supabase_realtime add table public.servicio_estados;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
