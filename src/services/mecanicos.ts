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

async function consultarMecanicos(): Promise<Mecanico[]> {
  const { data, error } = await supabase
    .from('mecanicos')
    .select(
      'id, nombre, descripcion, telefono, localidad, latitud, longitud, disponible, imagen_url, especialidades',
    )
    .order('nombre');

  if (error) {
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
    especialidades: mecanico.especialidades ?? [],
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

/**
 * Obtiene la ficha y disponibilidad del mecánico autenticado (RF-PROF-003).
 */
export async function obtenerMecanicoActual(): Promise<Mecanico | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('mecanicos')
    .select(
      'id, nombre, descripcion, telefono, localidad, latitud, longitud, disponible, imagen_url, especialidades',
    )
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el taller: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    perfil_id: user.id,
    nombre_taller: data.nombre,
    descripcion: data.descripcion,
    logo_url: data.imagen_url,
    direccion_taller: data.localidad ?? '',
    localidad: data.localidad ?? 'Localidad no indicada',
    latitud: data.latitud ?? 0,
    longitud: data.longitud ?? 0,
    radio_cobertura_km: 0,
    atiende_a_domicilio: false,
    disponible: data.disponible,
    verificado: false,
    calificacion_promedio: null,
    cantidad_calificaciones: 0,
    servicios_completados: 0,
    especialidades: data.especialidades ?? [],
    distancia_km: null,
    abierto_ahora: false,
  };
}

/**
 * Modifica la disponibilidad del mecánico autenticado (RF-PROF-003, RN-003).
 * Intenta por la RPC segura y tiene respaldo por UPDATE directo.
 */
export async function actualizarDisponibilidadMecanico(disponible: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tenés que iniciar sesión.');

  const { error: rpcError } = await supabase.rpc('cambiar_disponibilidad_mecanico', {
    p_disponible: disponible,
  });

  if (rpcError) {
    const { error: updateError } = await supabase
      .from('mecanicos')
      .update({ disponible })
      .eq('usuario_id', user.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar la disponibilidad: ${updateError.message}`);
    }
  }
}
