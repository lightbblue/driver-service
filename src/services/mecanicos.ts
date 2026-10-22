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
};

async function consultarMecanicos(): Promise<Mecanico[]> {
  const { data, error } = await supabase
    .from('mecanicos')
    .select(
      'id, nombre, descripcion, telefono, localidad, latitud, longitud, disponible, imagen_url',
    )
    .order('nombre');

  if (error) {
    console.error('[MECANICOS] Error al consultar Supabase:', error);
    throw new Error(
      `No se pudieron cargar los mecánicos: ${error.message}`,
    );
  }

  return ((data ?? []) as MecanicoDB[]).map((mecanico) => ({
    id: mecanico.id,
    perfil_id: '',
    nombre_taller: mecanico.nombre,
    descripcion: mecanico.descripcion,
    logo_url: mecanico.imagen_url,
    direccion_taller: mecanico.localidad ?? '',
    localidad: mecanico.localidad ?? 'Localidad no indicada',
    latitud: mecanico.latitud ?? 0,
    longitud: mecanico.longitud ?? 0,
    radio_cobertura_km: 0,
    atiende_a_domicilio: false,
    disponible: mecanico.disponible,
    verificado: false,
    calificacion_promedio: null,
    cantidad_calificaciones: 0,
    servicios_completados: 0,
    especialidades: [],
    distancia_km: null,
    abierto_ahora: false,
  }));
}

/** Consulta los mecánicos registrados en Supabase. */
export async function listarMecanicos(): Promise<Mecanico[]> {
  return consultarMecanicos();
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
