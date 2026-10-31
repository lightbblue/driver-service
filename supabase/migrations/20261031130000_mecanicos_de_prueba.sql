-- RNF-TEST-002: talleres de ejemplo para probar ubicaciones, especialidades y disponibilidad.
-- Requiere 20261029200531_registro_mecanico.sql.

begin;

insert into public.mecanicos (
  nombre,
  descripcion,
  localidad,
  latitud,
  longitud,
  disponible,
  especialidades
)
select
  ejemplos.nombre,
  ejemplos.descripcion,
  ejemplos.localidad,
  ejemplos.latitud,
  ejemplos.longitud,
  ejemplos.disponible,
  ejemplos.especialidades
from (
  values
    (
      'Motores del Norte',
      'Diagnóstico eléctrico y reparación de sistemas de encendido.',
      'Tigre, Buenos Aires',
      -34.4260::double precision,
      -58.5790::double precision,
      true,
      array['Eléctrica', 'Mecánica general']::text[]
    ),
    (
      'Taller El Cruce',
      'Mecánica ligera y asistencia para motos urbanas.',
      'Garín, Buenos Aires',
      -34.4300::double precision,
      -58.7480::double precision,
      true,
      array['Mecánica general', 'A domicilio']::text[]
    ),
    (
      'Neumáticos Escobar',
      'Reparación de pinchaduras y cambio de neumáticos.',
      'Belén de Escobar, Buenos Aires',
      -34.3480::double precision,
      -58.7940::double precision,
      true,
      array['Neumáticos']::text[]
    ),
    (
      'Auxilio Moto 24',
      'Asistencia de emergencia y traslado de motocicletas.',
      'José C. Paz, Buenos Aires',
      -34.5150::double precision,
      -58.7600::double precision,
      false,
      array['Emergencias', 'A domicilio']::text[]
    )
) as ejemplos(nombre, descripcion, localidad, latitud, longitud, disponible, especialidades)
where not exists (
  select 1
  from public.mecanicos existentes
  where existentes.nombre = ejemplos.nombre
    and existentes.localidad = ejemplos.localidad
);

commit;
