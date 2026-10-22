-- =============================================================================
-- REQ-01 / REQ-05 — Estructura para solicitudes reales y su seguimiento
--
-- Se ajusta a las tablas que ya existen en Supabase: solo agrega columnas,
-- restricciones e índices. No renombra ni elimina nada.
--
--   solicitudes(id, usuario_id, mecanico_id, categoria_id, descripcion, direccion,
--               latitud, longitud, estado, precio_estimado, creado_en)
--   historial_solicitudes(id, solicitud_id, estado, nota, creado_en)
--   mecanicos(id, nombre, descripcion, telefono, localidad, latitud, longitud,
--             disponible, imagen_url, creado_en)
--
-- Es idempotente: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Estados del servicio (RF-STATE-001). Se conserva 'pendiente', el valor que la
-- app ya guardaba, como estado inicial ("Solicitado" en el SRS):
--   pendiente → aceptado → en_camino → llegue → trabajando → finalizado
--   y cancelada desde cualquier estado anterior a trabajando (RN-009).
-- -----------------------------------------------------------------------------

-- Variantes de escritura que pudieran existir en los datos.
update public.solicitudes set estado = 'pendiente'  where estado in ('solicitado', 'solicitada');
update public.solicitudes set estado = 'aceptado'   where estado = 'aceptada';
update public.solicitudes set estado = 'finalizado' where estado in ('finalizada', 'completada');
update public.solicitudes set estado = 'cancelada'  where estado = 'cancelado';
update public.historial_solicitudes set estado = 'pendiente'  where estado in ('solicitado', 'solicitada');
update public.historial_solicitudes set estado = 'aceptado'   where estado = 'aceptada';
update public.historial_solicitudes set estado = 'finalizado' where estado in ('finalizada', 'completada');
update public.historial_solicitudes set estado = 'cancelada'  where estado = 'cancelado';

-- Se reemplazan las restricciones CHECK previas sobre `estado`, si las hubiera.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.solicitudes'::regclass, 'public.historial_solicitudes'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%estado%'
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

-- NOT VALID: se exige a los datos nuevos sin rechazar valores que ya estuvieran cargados.
alter table public.solicitudes
  add constraint solicitudes_estado_check check (estado in
    ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'cancelada')) not valid;

alter table public.historial_solicitudes
  add constraint historial_solicitudes_estado_check check (estado in
    ('pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'cancelada')) not valid;

-- -----------------------------------------------------------------------------
-- solicitudes
-- -----------------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists codigo             text,
  add column if not exists eta_minutos        integer,
  add column if not exists motivo_cancelacion text,
  add column if not exists actualizado_en     timestamptz not null default now();

alter table public.solicitudes
  alter column usuario_id set default auth.uid(),
  alter column estado     set default 'pendiente';

alter table public.solicitudes
  drop constraint if exists solicitudes_eta_check,
  drop constraint if exists solicitudes_codigo_key;

alter table public.solicitudes
  add constraint solicitudes_eta_check check (eta_minutos is null or eta_minutos between 1 and 600);

-- RF-ASSIST-005: identificador legible #RS-AAAA-NNNN.
create sequence if not exists public.seq_solicitud_codigo;

create or replace function public.fn_codigo_solicitud()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null then
    new.codigo := 'RS-' || to_char(coalesce(new.creado_en, now()), 'YYYY') || '-' ||
                  lpad(nextval('public.seq_solicitud_codigo')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_codigo_solicitud on public.solicitudes;
create trigger trg_codigo_solicitud
  before insert on public.solicitudes
  for each row execute function public.fn_codigo_solicitud();

-- Código para las solicitudes ya cargadas, en orden de creación.
do $$
declare
  r record;
begin
  for r in select id, creado_en from public.solicitudes where codigo is null order by creado_en, id loop
    update public.solicitudes
    set codigo = 'RS-' || to_char(r.creado_en, 'YYYY') || '-' ||
                 lpad(nextval('public.seq_solicitud_codigo')::text, 4, '0')
    where id = r.id;
  end loop;
end $$;

alter table public.solicitudes alter column codigo set not null;
alter table public.solicitudes add constraint solicitudes_codigo_key unique (codigo);

create index if not exists solicitudes_usuario_idx  on public.solicitudes (usuario_id, creado_en desc);
create index if not exists solicitudes_mecanico_idx on public.solicitudes (mecanico_id, creado_en desc);
create index if not exists solicitudes_estado_idx   on public.solicitudes (estado);

-- -----------------------------------------------------------------------------
-- historial_solicitudes: la bitácora de RF-DATA-004 necesita también el estado
-- anterior y el actor. La observación de cada cambio va en `nota`.
-- -----------------------------------------------------------------------------

alter table public.historial_solicitudes
  add column if not exists estado_anterior text,
  add column if not exists usuario_id      uuid default auth.uid() references auth.users (id) on delete set null;

alter table public.historial_solicitudes alter column creado_en set default now();

create index if not exists historial_solicitud_idx on public.historial_solicitudes (solicitud_id, creado_en);

-- -----------------------------------------------------------------------------
-- mecanicos: vínculo entre el taller y la cuenta del mecánico que lo opera.
-- Sin él no hay forma de saber quién puede aceptar solicitudes (RF-MATCH-003).
-- -----------------------------------------------------------------------------

alter table public.mecanicos
  add column if not exists usuario_id uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.mecanicos'::regclass and conname = 'mecanicos_usuario_id_key') then
    alter table public.mecanicos add constraint mecanicos_usuario_id_key unique (usuario_id);
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
