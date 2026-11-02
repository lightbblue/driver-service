-- Fotos del taller, reseñas del taller y catálogo de especialidades.
-- - fotos_taller: galería que carga el dueño y ven los clientes en el detalle del taller.
-- - resenas_taller: estrellas (1 a 5) y comentario del cliente al taller, aparte de la
--   calificación de cada mecánico. Solo reseña quien tuvo un servicio finalizado con el taller.
-- - especialidades: lista fija de tags. Talleres y mecánicos solo pueden usar estas.

begin;

-- 1. Catálogo de especialidades
create table if not exists public.especialidades (
  nombre text primary key,
  orden  smallint not null default 0
);

comment on table public.especialidades is 'Tags de especialidad que pueden elegir talleres y mecánicos (filtro del mapa).';

insert into public.especialidades (nombre, orden) values
  ('Mecánica general', 1),
  ('Motos', 2),
  ('Gomería', 3),
  ('Lubricentro', 4),
  ('Electricidad', 5),
  ('Batería', 6),
  ('Frenos', 7),
  ('Cadena y transmisión', 8),
  ('Suspensión', 9),
  ('Inyección y carburación', 10),
  ('Chapa y pintura', 11),
  ('Auxilio en ruta', 12)
on conflict (nombre) do nothing;

-- Lo que ya estaba cargado entra al catálogo para no romper nada.
insert into public.especialidades (nombre, orden)
select distinct e, 50
  from (select unnest(especialidades) e from public.talleres
        union select unnest(especialidades) from public.mecanicos) x
 where e is not null and btrim(e) <> ''
on conflict (nombre) do nothing;

alter table public.especialidades enable row level security;
drop policy if exists "especialidades: lectura pública" on public.especialidades;
create policy "especialidades: lectura pública" on public.especialidades for select to anon, authenticated using (true);
grant select on public.especialidades to anon, authenticated;

-- Talleres y mecánicos solo usan especialidades del catálogo.
create or replace function public.fn_validar_especialidades()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invalida text;
begin
  select e into v_invalida
    from unnest(coalesce(new.especialidades, '{}')) e
   where not exists (select 1 from public.especialidades c where c.nombre = e)
   limit 1;
  if v_invalida is not null then
    raise exception 'La especialidad "%" no está en la lista.', v_invalida using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validar_especialidades on public.talleres;
create trigger trg_validar_especialidades
  before insert or update of especialidades on public.talleres
  for each row execute function public.fn_validar_especialidades();

drop trigger if exists trg_validar_especialidades on public.mecanicos;
create trigger trg_validar_especialidades
  before insert or update of especialidades on public.mecanicos
  for each row execute function public.fn_validar_especialidades();

-- 2. Fotos del taller
create table if not exists public.fotos_taller (
  id        uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  url       text not null,
  creado_en timestamptz not null default now()
);

create index if not exists fotos_taller_taller_idx on public.fotos_taller (taller_id, creado_en);

alter table public.fotos_taller enable row level security;
drop policy if exists "fotos_taller: lectura pública" on public.fotos_taller;
create policy "fotos_taller: lectura pública" on public.fotos_taller for select to anon, authenticated using (true);
grant select on public.fotos_taller to anon, authenticated;

create or replace function public.agregar_foto_taller(p_url text)
returns public.fotos_taller
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_taller uuid := public.taller_del_dueno();
  v_foto   public.fotos_taller;
begin
  if nullif(btrim(coalesce(p_url, '')), '') is null then
    raise exception 'Falta la foto.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.fotos_taller where taller_id = v_taller) >= 10 then
    raise exception 'El taller ya tiene 10 fotos. Borrá alguna para agregar otra.' using errcode = 'P0001';
  end if;
  insert into public.fotos_taller (taller_id, url) values (v_taller, p_url) returning * into v_foto;
  return v_foto;
end;
$$;

create or replace function public.eliminar_foto_taller(p_foto_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.fotos_taller where id = p_foto_id and taller_id = public.taller_del_dueno();
  if not found then
    raise exception 'Esa foto no es de tu taller.' using errcode = 'P0001';
  end if;
end;
$$;

-- 3. Reseñas del taller
create table if not exists public.resenas_taller (
  id         uuid primary key default gen_random_uuid(),
  taller_id  uuid not null references public.talleres (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  puntaje    smallint not null check (puntaje between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 300),
  creado_en  timestamptz not null default now(),
  unique (taller_id, cliente_id)
);

comment on table public.resenas_taller is 'Reseña del cliente al taller (aparte de la calificación de cada mecánico).';

create index if not exists resenas_taller_taller_idx on public.resenas_taller (taller_id, creado_en desc);

alter table public.resenas_taller enable row level security;
revoke insert, update, delete on public.resenas_taller from authenticated;
drop policy if exists "resenas_taller: lectura" on public.resenas_taller;
create policy "resenas_taller: lectura" on public.resenas_taller for select to authenticated using (true);
grant select on public.resenas_taller to authenticated;

-- Reseña quien tuvo un servicio finalizado con el taller (pedido al taller o hecho por uno de sus mecánicos).
create or replace function public.puede_resenar_taller(p_taller_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.solicitudes s
     where s.usuario_id = auth.uid()
       and s.estado = 'finalizado'
       and (s.taller_solicitado_id = p_taller_id
            or s.mecanico_id in (select m.id from public.mecanicos m where m.taller_id = p_taller_id))
  );
$$;

create or replace function public.resenar_taller(p_taller_id uuid, p_puntaje integer, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_puntaje is null or p_puntaje < 1 or p_puntaje > 5 then
    raise exception 'Elegí entre 1 y 5 estrellas.' using errcode = 'P0001';
  end if;
  if not public.puede_resenar_taller(p_taller_id) then
    raise exception 'Podés reseñar el taller después de que te atienda.' using errcode = 'P0001';
  end if;

  insert into public.resenas_taller (taller_id, cliente_id, puntaje, comentario)
  values (p_taller_id, auth.uid(), p_puntaje, nullif(btrim(coalesce(p_comentario, '')), ''))
  on conflict (taller_id, cliente_id)
  do update set puntaje = excluded.puntaje, comentario = excluded.comentario, creado_en = now();
end;
$$;

-- Reseñas con el nombre y la foto de quien las escribió (perfiles solo deja leer el propio).
create or replace function public.resenas_de_taller(p_taller_id uuid)
returns table (id uuid, nombre text, avatar_url text, puntaje smallint, comentario text, creado_en timestamptz, es_mia boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id,
         coalesce(nullif(btrim(p.nombre), ''), 'Cliente'),
         p.avatar_url,
         r.puntaje,
         r.comentario,
         r.creado_en,
         r.cliente_id = auth.uid()
    from public.resenas_taller r
    left join public.perfiles p on p.id = r.cliente_id
   where r.taller_id = p_taller_id
   order by (r.cliente_id = auth.uid()) desc, r.creado_en desc
   limit 30;
$$;

-- 4. Resumen de cada taller: reseñas del taller, mecánicos y sus estrellas
drop function if exists public.resumen_talleres();
create function public.resumen_talleres()
returns table (
  taller_id uuid,
  promedio numeric,
  cantidad integer,
  mecanicos integer,
  disponibles integer,
  promedio_mecanicos numeric,
  calificaciones_mecanicos integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id,
         (select round(avg(r.puntaje), 1) from public.resenas_taller r where r.taller_id = t.id),
         (select count(*)::integer from public.resenas_taller r where r.taller_id = t.id),
         (select count(*)::integer from public.mecanicos m where m.taller_id = t.id and m.usuario_id is not null),
         (select count(*)::integer from public.mecanicos m
           where m.taller_id = t.id and m.usuario_id is not null and m.disponible),
         (select round(avg(c.puntaje), 1)
            from public.calificaciones c join public.mecanicos m on m.id = c.mecanico_id
           where m.taller_id = t.id),
         (select count(*)::integer
            from public.calificaciones c join public.mecanicos m on m.id = c.mecanico_id
           where m.taller_id = t.id)
    from public.talleres t;
$$;

revoke execute on function public.fn_validar_especialidades() from public, anon, authenticated;
revoke execute on function public.agregar_foto_taller(text) from public, anon;
revoke execute on function public.eliminar_foto_taller(uuid) from public, anon;
revoke execute on function public.puede_resenar_taller(uuid) from public, anon;
revoke execute on function public.resenar_taller(uuid, integer, text) from public, anon;
revoke execute on function public.resenas_de_taller(uuid) from public, anon;
revoke execute on function public.resumen_talleres() from public, anon;
grant execute on function public.agregar_foto_taller(text) to authenticated;
grant execute on function public.eliminar_foto_taller(uuid) to authenticated;
grant execute on function public.puede_resenar_taller(uuid) to authenticated;
grant execute on function public.resenar_taller(uuid, integer, text) to authenticated;
grant execute on function public.resenas_de_taller(uuid) to authenticated;
grant execute on function public.resumen_talleres() to authenticated;

commit;

notify pgrst, 'reload schema';
