import { supabase } from '@/lib/supabase';
import type { Mecanico } from '@/types';

type MecanicoDB = {
  id: string;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  localidad: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  disponible: boolean;
  imagen_url: string | null;
  especialidades: string[] | null;
};

/** Calcula la distancia en kilómetros entre dos coordenadas geográficas (fórmula de Haversine). */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/** Indica si el mecánico tiene una ubicación cargada para mostrarlo en el mapa. */
export function tieneUbicacion(mecanico: Mecanico): boolean {
  return mecanico.latitud !== 0 || mecanico.longitud !== 0;
}

async function consultarMecanicos(
  posicionUsuario?: { latitud: number; longitud: number } | null,
): Promise<Mecanico[]> {
  const { data, error } = await supabase
    .from('mecanicos')
    .select(
      'id, nombre, descripcion, telefono, localidad, direccion, latitud, longitud, disponible, imagen_url, especialidades',
    )
    .order('nombre');

  if (error) {
    throw new Error(`No se pudieron cargar los mecánicos: ${error.message}`);
  }

  // Solo datos reales: lo que no está cargado queda vacío en vez de inventarse.
  const mecanicos: Mecanico[] = ((data ?? []) as MecanicoDB[]).map((mecanico) => ({
    id: mecanico.id,
    perfil_id: '',
    nombre_taller: mecanico.nombre,
    descripcion: mecanico.descripcion,
    logo_url: mecanico.imagen_url,
    // Vacía para quien hace asistencia en ruta: no tiene taller.
    direccion_taller: mecanico.direccion ?? '',
    localidad: mecanico.localidad ?? 'Localidad no indicada',
    telefono: mecanico.telefono,
    latitud: mecanico.latitud ?? 0,
    longitud: mecanico.longitud ?? 0,
    radio_cobertura_km: 0,
    atiende_a_domicilio: false,
    disponible: mecanico.disponible,
    verificado: false,
    calificacion_promedio: null,
    cantidad_calificaciones: 0,
    servicios_completados: 0,
    especialidades: mecanico.especialidades ?? [],
    distancia_km: null,
    abierto_ahora: false,
  }));

  if (!posicionUsuario) return mecanicos;

  // Con la posición del usuario se calcula la distancia y se ordena del más cercano al más lejano.
  return mecanicos
    .map((mecanico) =>
      tieneUbicacion(mecanico)
        ? {
            ...mecanico,
            distancia_km: calcularDistanciaKm(
              posicionUsuario.latitud,
              posicionUsuario.longitud,
              mecanico.latitud,
              mecanico.longitud,
            ),
          }
        : mecanico,
    )
    .sort((a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity));
}

/** Consulta los mecánicos registrados en Supabase (calcula distancia si se provee posición). */
export async function listarMecanicos(
  posicionUsuario?: { latitud: number; longitud: number } | null,
): Promise<Mecanico[]> {
  return consultarMecanicos(posicionUsuario);
}

/** Devuelve los mecánicos disponibles para el inicio. */
export async function listarMecanicosDestacados(
  limite = 6,
): Promise<Mecanico[]> {
  const mecanicos = await consultarMecanicos();

  return mecanicos
    .filter((mecanico) => mecanico.disponible)
    .slice(0, limite);
}

/** Busca un mecánico por su identificador real de Supabase. */
export async function obtenerMecanico(
  id: string | null,
): Promise<Mecanico | null> {
  if (!id) return null;

  const mecanicos = await consultarMecanicos();

  return mecanicos.find((mecanico) => mecanico.id === id) ?? null;
}
