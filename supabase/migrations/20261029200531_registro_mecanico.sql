-- Aplicada en Supabase el 2026-10-29 (versión 20261029200531).

-- Especialidades del mecánico (se muestran en las tarjetas y se cargan en el registro).
alter table public.mecanicos
  add column if not exists especialidades text[] not null default '{}';

-- Al crear una cuenta: siempre se crea el perfil; si el rol es mecánico, también su fila en mecanicos.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.perfiles (id, nombre, telefono)
  values (
    new.id,
    coalesce(meta ->> 'nombre', ''),
    nullif(meta ->> 'telefono', '')
  )
  on conflict (id) do nothing;

  if meta ->> 'rol' = 'mecanico' then
    insert into public.mecanicos (usuario_id, nombre, descripcion, telefono, localidad, especialidades, disponible)
    values (
      new.id,
      coalesce(nullif(meta ->> 'taller_nombre', ''), nullif(meta ->> 'nombre', ''), 'Mecánico'),
      nullif(meta ->> 'taller_descripcion', ''),
      nullif(meta ->> 'telefono', ''),
      nullif(meta ->> 'taller_ubicacion', ''),
      case
        when jsonb_typeof(meta -> 'taller_especialidades') = 'array'
          then array(select jsonb_array_elements_text(meta -> 'taller_especialidades'))
        else '{}'::text[]
      end,
      true
    )
    on conflict (usuario_id) do nothing;
  end if;

  return new;
end;
$function$;

-- Solo la usa el trigger: nadie debe poder llamarla por la API.
revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;
