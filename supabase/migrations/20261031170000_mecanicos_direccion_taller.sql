-- Dirección y coordenadas del taller desde el registro.
-- Un mecánico puede tener taller (dirección + coordenadas: aparece en el mapa) o hacer
-- asistencia en ruta (solo localidad: la zona donde trabaja; no aparece en el mapa).

alter table public.mecanicos
  add column if not exists direccion text;

comment on column public.mecanicos.localidad is 'Zona donde trabaja el mecánico (ej: Pilar).';
comment on column public.mecanicos.direccion is 'Dirección del taller; null si hace asistencia en ruta.';

-- Al crear una cuenta: siempre se crea el perfil; si el rol es mecánico, también su fila en mecanicos.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tiene_coordenadas boolean :=
    jsonb_typeof(meta -> 'taller_latitud') = 'number'
    and jsonb_typeof(meta -> 'taller_longitud') = 'number';
begin
  insert into public.perfiles (id, nombre, telefono)
  values (
    new.id,
    coalesce(meta ->> 'nombre', ''),
    nullif(meta ->> 'telefono', '')
  )
  on conflict (id) do nothing;

  if meta ->> 'rol' = 'mecanico' then
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
