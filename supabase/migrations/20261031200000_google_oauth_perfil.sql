-- Inicio de sesión con Google (RF-AUTH-007, RN-015).
-- - El nombre sale de `nombre` (registro propio) o de `full_name` / `name` (Google).
-- - La foto sale de `avatar_url` o `picture` (Google).
-- - Una cuenta creada con Google es siempre cliente: nunca se le crea ficha de mecánico,
--   aunque sus metadatos digan otra cosa. El rol de la app se lee de user_metadata.rol,
--   que Google no completa, así que queda como cliente.

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  proveedor text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  tiene_coordenadas boolean :=
    jsonb_typeof(meta -> 'taller_latitud') = 'number'
    and jsonb_typeof(meta -> 'taller_longitud') = 'number';
begin
  insert into public.perfiles (id, nombre, telefono, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(meta ->> 'nombre', ''),
      nullif(meta ->> 'full_name', ''),
      nullif(meta ->> 'name', ''),
      ''
    ),
    nullif(meta ->> 'telefono', ''),
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', ''))
  )
  on conflict (id) do nothing;

  -- RN-015: el registro de mecánicos solo se hace con el formulario (proveedor email).
  if meta ->> 'rol' = 'mecanico' and proveedor = 'email' then
    insert into public.mecanicos (
      usuario_id, nombre, descripcion, telefono, localidad,
      direccion, latitud, longitud, especialidades, disponible
    )
    values (
      new.id,
      coalesce(nullif(meta ->> 'taller_nombre', ''), nullif(meta ->> 'nombre', ''), 'Mecánico'),
      nullif(meta ->> 'taller_descripcion', ''),
      nullif(meta ->> 'telefono', ''),
      nullif(meta ->> 'taller_ubicacion', ''),
      case when tiene_coordenadas then nullif(meta ->> 'taller_direccion', '') end,
      case when tiene_coordenadas then (meta ->> 'taller_latitud')::double precision end,
      case when tiene_coordenadas then (meta ->> 'taller_longitud')::double precision end,
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
