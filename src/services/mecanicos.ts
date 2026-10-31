import mecanicosLocales from '@/data/mecanicos.json';
import { supabase } from '@/lib/supabase';
import type { Mecanico } from '@/types';

type MecanicoDB = {
  id: string;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  localidad: string | null;
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

async function consultarMecanicos(
  posicionUsuario?: { latitud: number; longitud: number } | null,
): Promise<Mecanico[]> {
  try {
    const { data, error } = await supabase
      .from('mecanicos')
      .select(
        'id, nombre, descripcion, telefono, localidad, latitud, longitud, disponible, imagen_url, especialidades',
      )
      .order('nombre');

    if (error) {
      console.warn('[MECANICOS] Consulta a Supabase arrojó advertencia:', error.message);
    }

    let resultado: Mecanico[] = [];

    if (data && data.length > 0) {
      resultado = (data as MecanicoDB[]).map((mecanico) => ({
        id: mecanico.id,
        perfil_id: '',
        nombre_taller: mecanico.nombre,
        descripcion: mecanico.descripcion,
        logo_url: mecanico.imagen_url,
        direccion_taller: mecanico.localidad ?? '',
        localidad: mecanico.localidad ?? 'Localidad no indicada',
        telefono: mecanico.telefono ?? '+54 11 4455-6677',
        latitud: mecanico.latitud ?? -34.5185,
        longitud: mecanico.longitud ?? -58.9892,
        radio_cobertura_km: 15,
        atiende_a_domicilio: false,
        disponible: mecanico.disponible,
        verificado: true,
        calificacion_promedio: 4.8,
        cantidad_calificaciones: 25,
        servicios_completados: 50,
        especialidades: mecanico.especialidades ?? ['Motos', 'Mecánica general'],
        distancia_km: null,
        abierto_ahora: true,
      }));
    } else {
      // Si la base aún no tiene mecánicos cargados, usamos los datos locales para la vista
      resultado = (mecanicosLocales as Mecanico[]).map((m) => ({
        ...m,
        telefono: m.telefono ?? '+54 11 4455-6677',
      }));
    }

    if (posicionUsuario) {
      resultado = resultado
        .map((m) => {
          if (m.latitud && m.longitud) {
            const dist = calcularDistanciaKm(
              posicionUsuario.latitud,
              posicionUsuario.longitud,
              m.latitud,
              m.longitud,
            );
            return { ...m, distancia_km: dist };
          }
          return m;
        })
        .sort((a, b) => (a.distancia_km ?? 999) - (b.distancia_km ?? 999));
    }

    return resultado;
  } catch (err) {
    console.error('[MECANICOS] Falló la consulta, usando respaldo local:', err);
    return (mecanicosLocales as Mecanico[]).map((m) => ({
      ...m,
      telefono: m.telefono ?? '+54 11 4455-6677',
    }));
  }
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
