-- =============================================================================
-- REQ-01 / REQ-05 — Solicitudes reales, seguimiento del servicio y RLS
--
-- Parte del esquema que ya existe en el proyecto (verificado por la API REST):
--   categorias_averia(id, nombre, descripcion, icono)
--   solicitudes(id, usuario_id, mecanico_id -> mecanicos, categoria_id -> categorias_averia,
--               descripcion, direccion, latitud, longitud, estado, creado_en)
--   historial_solicitudes(id, solicitud_id -> solicitudes, estado, creado_en)
--   mecanicos(id, nombre, telefono, descripcion, localidad, latitud, longitud, disponible, creado_en)
--
-- Es idempotente: se puede ejecutar más de una vez desde el SQL Editor.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Estados del servicio
--    solicitado → aceptado → en_camino → llegue → trabajando → finalizado
--    y `cancelada` desde cualquier estado previo a `trabajando`.
-- -----------------------------------------------------------------------------

-- La app guardaba 'pendiente'; se unifica con el nombre del dominio.
update public.solicitudes set estado = 'solicitado' where estado in ('pendiente', 'solicitada');
update public.solicitudes set estado = 'aceptado'   where estado = 'aceptada';
update public.solicitudes set estado = 'finalizado' where estado in ('finalizada', 'completada');
update public.solicitudes set estado = 'cancelada'  where estado = 'cancelado';
update public.historial_solicitudes set estado = 'solicitado' where estado in ('pendiente', 'solicitada');
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

-- -----------------------------------------------------------------------------
-- 2. Columnas nuevas
-- -----------------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists localidad          text,
  add column if not exists eta_minutos        integer,
  add column if not exists motivo_cancelacion text,
  add column if not exists cancelado_por      text,
  add column if not exists actualizado_en     timestamptz not null default now();

alter table public.solicitudes
  alter column usuario_id set default auth.uid(),
  alter column estado     set default 'solicitado',
  alter column estado     set not null,
  alter column creado_en  set default now();

alter table public.solicitudes
  drop constraint if exists solicitudes_cancelado_por_check,
  drop constraint if exists solicitudes_eta_check;

alter table public.solicitudes
  add constraint solicitudes_estado_check check (estado in
    ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'cancelada')),
  add constraint solicitudes_cancelado_por_check check (cancelado_por in ('cliente', 'mecanico')),
  add constraint solicitudes_eta_check check (eta_minutos is null or eta_minutos between 1 and 600);

alter table public.historial_solicitudes
  add column if not exists estado_anterior text,
  add column if not exists observacion     text,
  add column if not exists usuario_id      uuid default auth.uid();

alter table public.historial_solicitudes
  alter column creado_en set default now();

alter table public.historial_solicitudes
  add constraint historial_solicitudes_estado_check check (estado in
    ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado', 'cancelada'));

create index if not exists solicitudes_usuario_idx  on public.solicitudes (usuario_id, creado_en desc);
create index if not exists solicitudes_mecanico_idx on public.solicitudes (mecanico_id, creado_en desc);
create index if not exists historial_solicitud_idx  on public.historial_solicitudes (solicitud_id, creado_en);

-- Vínculo entre el taller y la cuenta del mecánico que lo opera.
alter table public.mecanicos
  add column if not exists usuario_id uuid unique references auth.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 3. Funciones auxiliares
-- -----------------------------------------------------------------------------

-- Taller del usuario autenticado, o null si no es mecánico.
-- Admite tanto `mecanicos.usuario_id` como un `mecanicos.id` igual al id del usuario.
create or replace function public.mecanico_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.mecanicos
  where usuario_id = auth.uid() or id = auth.uid()
  limit 1;
$$;

-- Registra el estado inicial en el historial al crear la solicitud.
create or replace function public.registrar_solicitud_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.historial_solicitudes (solicitud_id, estado_anterior, estado, observacion, usuario_id)
  select new.id, null, new.estado, null, new.usuario_id
  where not exists (select 1 from public.historial_solicitudes h where h.solicitud_id = new.id);
  return new;
end;
$$;

drop trigger if exists solicitudes_historial_inicial on public.solicitudes;
create trigger solicitudes_historial_inicial
  after insert on public.solicitudes
  for each row execute function public.registrar_solicitud_inicial();

-- -----------------------------------------------------------------------------
-- 4. Cambio de estado: única vía para modificar una solicitud
-- -----------------------------------------------------------------------------

create or replace function public.cambiar_estado_solicitud(
  p_solicitud_id uuid,
  p_estado       text,
  p_observacion  text    default null,
  p_eta_minutos  integer default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  s             public.solicitudes;
  v_usuario     uuid := auth.uid();
  v_mecanico    uuid := public.mecanico_id_actual();
  v_es_cliente  boolean;
  v_es_asignado boolean;
  v_obs         text := nullif(btrim(coalesce(p_observacion, '')), '');
begin
  if v_usuario is null then
    raise exception 'Tenés que iniciar sesión para continuar.';
  end if;

  select * into s from public.solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;

  v_es_cliente  := s.usuario_id = v_usuario;
  v_es_asignado := v_mecanico is not null and s.mecanico_id = v_mecanico;

  if s.estado in ('finalizado', 'cancelada') then
    raise exception 'La solicitud ya está cerrada y no admite cambios.';
  end if;

  case p_estado
    when 'aceptado' then
      if v_mecanico is null then
        raise exception 'Solo un mecánico puede aceptar una solicitud.';
      end if;
      if s.estado <> 'solicitado' or s.mecanico_id is not null then
        raise exception 'Otro mecánico ya aceptó esta solicitud.';
      end if;
      s.mecanico_id := v_mecanico;
      s.eta_minutos := p_eta_minutos;

    when 'en_camino', 'llegue', 'trabajando', 'finalizado' then
      if not v_es_asignado then
        raise exception 'Solo el mecánico asignado puede actualizar el servicio.';
      end if;
      if s.estado <> case p_estado
                       when 'en_camino'  then 'aceptado'
                       when 'llegue'     then 'en_camino'
                       when 'trabajando' then 'llegue'
                       when 'finalizado' then 'trabajando'
                     end then
        raise exception 'No se puede pasar de "%" a "%".', s.estado, p_estado;
      end if;
      if p_estado = 'en_camino' then
        s.eta_minutos := coalesce(p_eta_minutos, s.eta_minutos);
      elsif p_estado = 'llegue' then
        s.eta_minutos := null;
      end if;

    when 'cancelada' then
      if not (v_es_cliente or v_es_asignado) then
        raise exception 'No tenés permiso para cancelar esta solicitud.';
      end if;
      if s.estado = 'trabajando' then
        raise exception 'El trabajo ya comenzó: no se puede cancelar, solo finalizar.';
      end if;
      -- El motivo es obligatorio cuando ya hay un mecánico involucrado.
      if v_obs is null and (s.mecanico_id is not null or v_es_asignado) then
        raise exception 'Indicá el motivo de la cancelación.';
      end if;
      s.motivo_cancelacion := v_obs;
      s.cancelado_por := case when v_es_asignado then 'mecanico' else 'cliente' end;
      s.eta_minutos := null;

    else
      raise exception 'Estado no válido: %', p_estado;
  end case;

  insert into public.historial_solicitudes (solicitud_id, estado_anterior, estado, observacion, usuario_id)
  values (s.id, s.estado, p_estado, v_obs, v_usuario);

  update public.solicitudes
  set estado             = p_estado,
      mecanico_id        = s.mecanico_id,
      eta_minutos        = s.eta_minutos,
      motivo_cancelacion = s.motivo_cancelacion,
      cancelado_por      = s.cancelado_por,
      actualizado_en     = now()
  where id = s.id
  returning * into s;

  return s;
end;
$$;

revoke all on function public.cambiar_estado_solicitud(uuid, text, text, integer) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer) to authenticated;
grant execute on function public.mecanico_id_actual() to authenticated;
revoke all on function public.registrar_solicitud_inicial() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
--    Se eliminan las políticas previas de `solicitudes` e `historial_solicitudes`
--    para que no quede ninguna permisiva que abra lo que estas cierran.
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('solicitudes', 'historial_solicitudes')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.solicitudes           enable row level security;
alter table public.historial_solicitudes enable row level security;
alter table public.categorias_averia     enable row level security;

-- Las modificaciones pasan siempre por cambiar_estado_solicitud().
revoke update, delete on public.solicitudes           from anon, authenticated;
revoke insert, update, delete on public.historial_solicitudes from anon, authenticated;
revoke all on public.solicitudes, public.historial_solicitudes from anon;
grant select, insert on public.solicitudes to authenticated;
grant select on public.historial_solicitudes to authenticated;

-- El cliente ve las suyas; el mecánico ve las asignadas y las que esperan mecánico.
create policy "solicitudes: lectura"
  on public.solicitudes for select to authenticated
  using (
    usuario_id = auth.uid()
    or mecanico_id = public.mecanico_id_actual()
    or (estado = 'solicitado' and mecanico_id is null and public.mecanico_id_actual() is not null)
  );

create policy "solicitudes: alta del cliente"
  on public.solicitudes for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and estado = 'solicitado'
    and mecanico_id is null
    and motivo_cancelacion is null
    and cancelado_por is null
  );

-- El historial se ve si se ve la solicitud (la subconsulta aplica la RLS de solicitudes).
create policy "historial: lectura"
  on public.historial_solicitudes for select to authenticated
  using (exists (select 1 from public.solicitudes s where s.id = solicitud_id));

drop policy if exists "categorias: lectura" on public.categorias_averia;
create policy "categorias: lectura"
  on public.categorias_averia for select to anon, authenticated
  using (true);

-- Nombre y teléfono del mecánico asignado, para mostrarlos en el seguimiento.
-- Solo tiene efecto si `mecanicos` tiene RLS habilitado.
drop policy if exists "mecanicos: lectura autenticados" on public.mecanicos;
create policy "mecanicos: lectura autenticados"
  on public.mecanicos for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 6. Realtime: el cliente ve al instante cuando el mecánico acepta o sale en camino
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes') then
    alter publication supabase_realtime add table public.solicitudes;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'historial_solicitudes') then
    alter publication supabase_realtime add table public.historial_solicitudes;
  end if;
end $$;

commit;

-- Refresca la caché de esquema de la API REST.
notify pgrst, 'reload schema';
