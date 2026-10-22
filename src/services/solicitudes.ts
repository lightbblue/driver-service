import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type {
  ActorCancelacion,
  EstadoServicio,
  HitoServicio,
  Servicio,
  UbicacionServicio,
} from '@/types';

import { obtenerUsuarioId } from './sesion';

/** Orden del flujo normal del servicio (sin la cancelación). */
export const FLUJO_ESTADOS: EstadoServicio[] = [
  'solicitado',
  'aceptado',
  'en_camino',
  'llegue',
  'trabajando',
  'finalizado',
];

const ESTADOS_ACTIVOS: EstadoServicio[] = FLUJO_ESTADOS.slice(0, -1);

export function esEstadoActivo(estado: EstadoServicio): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

/** El cliente puede cancelar mientras el trabajo no haya empezado. */
export function esCancelable(estado: EstadoServicio): boolean {
  return ['solicitado', 'aceptado', 'en_camino', 'llegue'].includes(estado);
}

/** Próximo estado que registra el mecánico asignado, o null si no hay. */
export function siguienteEstadoMecanico(estado: EstadoServicio): EstadoServicio | null {
  const siguientes: Partial<Record<EstadoServicio, EstadoServicio>> = {
    aceptado: 'en_camino',
    en_camino: 'llegue',
    llegue: 'trabajando',
    trabajando: 'finalizado',
  };
  return siguientes[estado] ?? null;
}

const COLUMNAS = `
  id, usuario_id, mecanico_id, categoria_id, descripcion,
  direccion, latitud, longitud, localidad,
  estado, eta_minutos, motivo_cancelacion, cancelado_por, creado_en, actualizado_en,
  categoria:categorias_averia ( nombre, icono ),
  mecanico:mecanicos ( id, nombre, telefono ),
  historial:historial_solicitudes ( id, estado_anterior, estado, observacion, creado_en )
`;

type FilaSolicitud = {
  id: string;
  usuario_id: string;
  mecanico_id: string | null;
  categoria_id: string | null;
  descripcion: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  localidad: string | null;
  estado: EstadoServicio;
  eta_minutos: number | null;
  motivo_cancelacion: string | null;
  cancelado_por: ActorCancelacion | null;
  creado_en: string;
  actualizado_en: string;
  categoria: { nombre: string; icono: string | null } | null;
  mecanico: { id: string; nombre: string | null; telefono: string | null } | null;
  historial:
    | {
        id: string;
        estado_anterior: EstadoServicio | null;
        estado: EstadoServicio;
        observacion: string | null;
        creado_en: string;
      }[]
    | null;
};

function aServicio(fila: FilaSolicitud): Servicio {
  const historial: HitoServicio[] = (fila.historial ?? [])
    .map((h) => ({
      id: h.id,
      estado_anterior: h.estado_anterior,
      estado_nuevo: h.estado,
      ocurrido_en: h.creado_en,
      observacion: h.observacion,
    }))
    .sort((a, b) => a.ocurrido_en.localeCompare(b.ocurrido_en));

  return {
    id: fila.id,
    codigo: `RS-${fila.id.slice(0, 8).toUpperCase()}`,
    cliente_id: fila.usuario_id,
    mecanico_id: fila.mecanico_id,
    mecanico: fila.mecanico,
    categoria_id: fila.categoria_id,
    categoria_nombre: fila.categoria?.nombre ?? 'Asistencia mecánica',
    categoria_icono: fila.categoria?.icono ?? null,
    descripcion: fila.descripcion,
    ubicacion: {
      latitud: fila.latitud ?? 0,
      longitud: fila.longitud ?? 0,
      direccion: fila.direccion ?? 'Sin dirección registrada',
      localidad: fila.localidad,
    },
    estado: fila.estado,
    eta_minutos: fila.eta_minutos,
    motivo_cancelacion: fila.motivo_cancelacion,
    cancelado_por: fila.cancelado_por,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
    finalizado_en:
      historial.find((h) => h.estado_nuevo === 'finalizado')?.ocurrido_en ?? null,
    historial,
  };
}

/** Solicitudes creadas por el usuario autenticado, de la más reciente a la más antigua. */
export async function listarSolicitudes(): Promise<Servicio[]> {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabase
    .from('solicitudes')
    .select(COLUMNAS)
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });

  if (error) lanzar(error, 'No se pudieron cargar tus solicitudes');
  return (data as unknown as FilaSolicitud[]).map(aServicio);
}

/** Bandeja del mecánico: lo que tiene asignado y lo que espera un mecánico. */
export async function listarSolicitudesMecanico(
  mecanicoId: string,
): Promise<{ asignadas: Servicio[]; disponibles: Servicio[] }> {
  const [asignadas, disponibles] = await Promise.all([
    supabase
      .from('solicitudes')
      .select(COLUMNAS)
      .eq('mecanico_id', mecanicoId)
      .order('creado_en', { ascending: false }),
    supabase
      .from('solicitudes')
      .select(COLUMNAS)
      .eq('estado', 'solicitado')
      .is('mecanico_id', null)
      .order('creado_en', { ascending: true }),
  ]);

  if (asignadas.error) lanzar(asignadas.error, 'No se pudieron cargar tus servicios');
  if (disponibles.error) lanzar(disponibles.error, 'No se pudieron cargar las solicitudes disponibles');

  return {
    asignadas: (asignadas.data as unknown as FilaSolicitud[]).map(aServicio),
    disponibles: (disponibles.data as unknown as FilaSolicitud[]).map(aServicio),
  };
}

export async function obtenerSolicitud(id: string): Promise<Servicio | null> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(COLUMNAS)
    .eq('id', id)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo cargar la solicitud');
  return data ? aServicio(data as unknown as FilaSolicitud) : null;
}

/** Solicitud en curso del usuario autenticado, si la hay. */
export async function obtenerSolicitudActiva(): Promise<Servicio | null> {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabase
    .from('solicitudes')
    .select(COLUMNAS)
    .eq('usuario_id', usuarioId)
    .in('estado', ESTADOS_ACTIVOS)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo consultar tu solicitud en curso');
  return data ? aServicio(data as unknown as FilaSolicitud) : null;
}

/** Guarda una solicitud para el usuario autenticado y devuelve su id. */
export async function crearSolicitud(datos: {
  categoriaId: string;
  descripcion: string;
  ubicacion: UbicacionServicio;
}): Promise<string> {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabase
    .from('solicitudes')
    .insert({
      usuario_id: usuarioId,
      categoria_id: datos.categoriaId,
      descripcion: datos.descripcion.trim() || null,
      direccion: datos.ubicacion.direccion.trim(),
      localidad: datos.ubicacion.localidad,
      latitud: datos.ubicacion.latitud,
      longitud: datos.ubicacion.longitud,
      estado: 'solicitado',
    })
    .select('id')
    .single();

  if (error) lanzar(error, 'No se pudo guardar la solicitud');
  return data.id as string;
}

/**
 * Registra un cambio de estado con su observación. La función de la base valida
 * quién puede hacerlo y desde qué estado, y escribe el historial.
 */
export async function cambiarEstadoSolicitud(
  id: string,
  estado: EstadoServicio,
  opciones: { observacion?: string; etaMinutos?: number | null } = {},
): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado_solicitud', {
    p_solicitud_id: id,
    p_estado: estado,
    p_observacion: opciones.observacion?.trim() || null,
    p_eta_minutos: opciones.etaMinutos ?? null,
  });

  if (error) lanzar(error, 'No se pudo actualizar la solicitud');
}

export async function cancelarSolicitud(id: string, motivo: string): Promise<void> {
  return cambiarEstadoSolicitud(id, 'cancelada', { observacion: motivo });
}

/**
 * Avisa cada vez que cambia una solicitud visible para el usuario (o una en
 * particular si se pasa `id`). Devuelve la función para desuscribirse.
 */
export function suscribirseASolicitudes(alCambiar: () => void, id?: string): () => void {
  const canal = supabase
    .channel(`solicitudes-${id ?? 'todas'}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'solicitudes', ...(id ? { filter: `id=eq.${id}` } : {}) },
      alCambiar,
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'historial_solicitudes',
        ...(id ? { filter: `solicitud_id=eq.${id}` } : {}),
      },
      alCambiar,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
