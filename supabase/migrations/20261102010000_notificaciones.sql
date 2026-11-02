-- Avisos dentro de la app (RF-NOTIF-001): la campana del inicio.
-- Los crea la base con triggers, la app solo los lee y los marca como leídos.
-- - Mecánico: cuando un cliente le pide asistencia a su taller (o a él, si trabaja en ruta).
-- - Cliente: cuando cambia el estado de su solicitud.

begin;

create table if not exists public.notificaciones (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users (id) on delete cascade,
  titulo       text not null,
  cuerpo       text,
  solicitud_id uuid references public.solicitudes (id) on delete cascade,
  leida        boolean not null default false,
  creado_en    timestamptz not null default now()
);

comment on table public.notificaciones is 'Avisos de la campana (RF-NOTIF-001). Los crean triggers de solicitudes.';

create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, creado_en desc);

alter table public.notificaciones enable row level security;

revoke all on public.notificaciones from anon;
revoke insert, delete, update on public.notificaciones from authenticated;
grant select on public.notificaciones to authenticated;
grant update (leida) on public.notificaciones to authenticated;

drop policy if exists "notificaciones: las propias" on public.notificaciones;
create policy "notificaciones: las propias"
  on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "notificaciones: marcar leídas" on public.notificaciones;
create policy "notificaciones: marcar leídas"
  on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Nueva solicitud dirigida: avisa a los mecánicos de ese taller (o al mecánico elegido).
create or replace function public.fn_notificar_solicitud_dirigida()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_categoria text;
begin
  if new.taller_solicitado_id is null and new.mecanico_solicitado_id is null then
    return new;
  end if;

  select nombre into v_categoria from public.categorias_averia where id = new.categoria_id;

  insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
  select m.usuario_id,
         case when new.taller_solicitado_id is not null
              then 'Nueva solicitud para tu taller'
              else 'Un cliente te pidió asistencia' end,
         coalesce(v_categoria, 'Asistencia') || ' · ' || coalesce(new.direccion, 'Sin dirección'),
         new.id
    from public.mecanicos m
   where m.usuario_id is not null
     and (m.taller_id = new.taller_solicitado_id or m.id = new.mecanico_solicitado_id);

  return new;
end;
$function$;

drop trigger if exists trg_notificar_solicitud_dirigida on public.solicitudes;
create trigger trg_notificar_solicitud_dirigida
  after insert on public.solicitudes
  for each row execute function public.fn_notificar_solicitud_dirigida();

-- Cambio de estado: avisa al cliente. Los pasos intermedios que la base agrupa
-- (aceptado → en camino, llegó → trabajando) generan un solo aviso.
create or replace function public.fn_notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulo text;
  v_cuerpo text;
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
    when 'trabajando' then
      v_titulo := 'El mecánico llegó';
      v_cuerpo := 'Ya está trabajando en tu moto.';
    when 'finalizado' then
      v_titulo := 'Servicio finalizado';
      v_cuerpo := 'Contanos cómo te fue: calificá al mecánico.';
    when 'no_resuelta' then
      v_titulo := 'No se pudo resolver';
      v_cuerpo := coalesce(new.motivo_no_resuelta, 'El mecánico no pudo resolver el problema.') || ' Se te devuelve el pago.';
    when 'cancelada' then
      -- Si cancela el propio cliente, no hace falta avisarle.
      if auth.uid() is not distinct from new.usuario_id then
        return new;
      end if;
      v_titulo := 'El mecánico canceló la solicitud';
      v_cuerpo := coalesce(new.motivo_cancelacion, 'Sin motivo indicado.') || ' Podés pedir asistencia de nuevo.';
    else
      return new;
  end case;

  insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
  values (new.usuario_id, v_titulo, v_cuerpo, new.id);

  return new;
end;
$function$;

drop trigger if exists trg_notificar_cambio_estado on public.solicitudes;
create trigger trg_notificar_cambio_estado
  after update of estado on public.solicitudes
  for each row execute function public.fn_notificar_cambio_estado();

revoke execute on function public.fn_notificar_solicitud_dirigida() from public, anon, authenticated;
revoke execute on function public.fn_notificar_cambio_estado() from public, anon, authenticated;

-- Realtime: la campana se actualiza sola.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
