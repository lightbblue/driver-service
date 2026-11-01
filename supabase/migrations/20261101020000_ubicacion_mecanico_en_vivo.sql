-- Ubicación del mecánico en vivo durante el servicio (RF-GPS-001, RF-GPS-002).
-- Va en una tabla aparte de `solicitudes` para que cada actualización de posición
-- no dispare la recarga completa del seguimiento.

create table if not exists public.ubicaciones_mecanico (
  solicitud_id   uuid primary key references public.solicitudes (id) on delete cascade,
  latitud        double precision not null check (latitud between -90 and 90),
  longitud       double precision not null check (longitud between -180 and 180),
  actualizado_en timestamptz not null default now()
);

comment on table public.ubicaciones_mecanico is
  'Última posición del mecánico asignado mientras el servicio está en curso. Se borra al finalizar o cancelar.';

alter table public.ubicaciones_mecanico enable row level security;

-- La ve quien puede ver la solicitud (las políticas de solicitudes ya restringen a sus actores).
drop policy if exists "ubicaciones_mecanico: actores del servicio" on public.ubicaciones_mecanico;
create policy "ubicaciones_mecanico: actores del servicio"
  on public.ubicaciones_mecanico for select
  to authenticated
  using (exists (select 1 from public.solicitudes s where s.id = solicitud_id));

-- Solo el mecánico asignado publica su posición, y solo con el servicio en curso.
create or replace function public.actualizar_ubicacion_mecanico(
  p_solicitud_id uuid,
  p_latitud double precision,
  p_longitud double precision
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_solicitud public.solicitudes;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id;
  if v_solicitud.id is null
     or not coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false) then
    raise exception 'Solo el mecánico asignado comparte su ubicación.' using errcode = 'P0001';
  end if;

  if v_solicitud.estado not in ('aceptado', 'en_camino', 'llegue', 'trabajando') then
    return;
  end if;

  insert into public.ubicaciones_mecanico (solicitud_id, latitud, longitud, actualizado_en)
  values (p_solicitud_id, p_latitud, p_longitud, now())
  on conflict (solicitud_id) do update
    set latitud = excluded.latitud, longitud = excluded.longitud, actualizado_en = now();
end;
$function$;

revoke execute on function public.actualizar_ubicacion_mecanico(uuid, double precision, double precision) from public, anon;
grant execute on function public.actualizar_ubicacion_mecanico(uuid, double precision, double precision) to authenticated;

-- RNF-PRIV-002: al terminar el servicio la posición del mecánico deja de guardarse.
create or replace function public.fn_limpiar_ubicacion_mecanico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.estado in ('finalizado', 'cancelada') and new.estado is distinct from old.estado then
    delete from public.ubicaciones_mecanico where solicitud_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_limpiar_ubicacion_mecanico on public.solicitudes;
create trigger trg_limpiar_ubicacion_mecanico
  after update of estado on public.solicitudes
  for each row execute function public.fn_limpiar_ubicacion_mecanico();

-- Realtime: el cliente ve moverse al mecánico sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ubicaciones_mecanico'
  ) then
    alter publication supabase_realtime add table public.ubicaciones_mecanico;
  end if;
end $$;
