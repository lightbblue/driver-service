-- Seed de talleres reales de Pilar y Tortuguitas (RNF-TEST-002).
-- Datos tomados de Google Maps el 31/10/2026: nombre, dirección, coordenadas, teléfono y horario.
-- El horario y los servicios van en la descripción. No se cargan ratings: la app solo
-- muestra calificaciones propias.
-- Es idempotente: no duplica un taller que ya exista con el mismo nombre.

insert into public.mecanicos (nombre, direccion, descripcion, telefono, localidad, latitud, longitud, especialidades, disponible)
select t.nombre, t.direccion, t.descripcion, t.telefono, t.localidad, t.latitud, t.longitud, t.especialidades, true
from (values
  ('Taller de Agustín Mecánico', 'Sanguinetti 1384, Pilar', null,
   '+54 9 11 2643-1990', 'Pilar', -34.463347, -58.8982784,
   array['Mecánica general']),
  ('Team Rush Automotriz', 'Benito Lynch 1330, Derqui',
   'Lun a vie 8:30 a 12:30 y 13:30 a 18; sáb 8:30 a 13.',
   '+54 11 3861-7109', 'Presidente Derqui', -34.4746055, -58.8516319,
   array['Mecánica general']),
  ('CarPatch', 'Av. Tomás Márquez 1099, Pilar',
   'Mecánica general, gomería 24 h y lubricentro.',
   '+54 11 7363-9616', 'Pilar', -34.4642296, -58.9103647,
   array['Mecánica general', 'Gomería', 'Lubricentro']),
  ('The Cars Pilar', 'Estanislao López 1074, Pilar Centro',
   'Mecánica y lubricentro.',
   '+54 11 6025-6292', 'Pilar', -34.4559483, -58.9208501,
   array['Mecánica general', 'Lubricentro']),
  ('JM Racing', 'Lorenzo López 1110, Pilar', null,
   '+54 11 2570-4837', 'Pilar', -34.459566, -58.9200521,
   array['Mecánica general']),
  ('Taller Mecánico Daniel', 'Colonia 89, Tortuguitas',
   'Lun a sáb 9 a 20.',
   '+54 11 3248-1013', 'Tortuguitas', -34.4831062, -58.7489406,
   array['Mecánica general']),
  ('Mecánica Siko', 'Av. Arturo Illia 11595, Tortuguitas',
   'Lun a vie 8:30 a 17:30; sáb 8:30 a 12.',
   '+54 9 2320 67-5714', 'Tortuguitas', -34.4794955, -58.7806873,
   array['Mecánica general']),
  ('Lubricentro Tortuguitas', '12 de Octubre 3981, Tortuguitas',
   'Lun a sáb 9 a 20.',
   '+54 11 6155-5794', 'Tortuguitas', -34.4732303, -58.7603247,
   array['Lubricentro']),
  ('Taller Automotriz San Miguel', 'Río de Janeiro 3277, Tortuguitas',
   'Lun a sáb 9 a 20:30 (vie hasta 21).',
   '+54 11 3303-4155', 'Tortuguitas', -34.4932216, -58.7924052,
   array['Mecánica general']),
  -- Google Maps no tiene calle para este taller: solo coordenadas.
  ('Mecánica Integral Pichón', null, null,
   '+54 2320 62-9562', 'Tortuguitas', -34.4882188, -58.77165,
   array['Mecánica general'])
) as t(nombre, direccion, descripcion, telefono, localidad, latitud, longitud, especialidades)
where not exists (
  select 1 from public.mecanicos m where lower(m.nombre) = lower(t.nombre)
);

-- Uno no disponible, para probar que no recibe solicitudes y se ve como tal (RNF-TEST-002).
update public.mecanicos set disponible = false
where nombre = 'JM Racing' and usuario_id is null;
