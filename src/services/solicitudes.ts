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
  id, codigo, cliente_id, mecanico_id, categoria_id, descripcion,
  latitud, longitud, direccion, localidad, referencia,
  estado, eta_minutos, motivo_cancelacion,
  creado_en, aceptado_en, en_camino_en, llegada_en, inicio_trabajo_en,
  finalizado_en, cancelado_en, actualizado_en,
  categoria:categorias_averia ( codigo, nombre, icono ),
  mecanico:mecanicos ( id, nombre_taller, perfil:perfiles ( nombre_completo, telefono ) ),
  historial:servicio_estados ( id, estado_anterior, estado_nuevo, actor_id, observacion, ocurrido_en )
`;

type FilaServicio = {
  id: string;
  codigo: string;
  cliente_id: string;
  mecanico_id: string | null;
  categoria_id: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  direccion: string;
  localidad: string | null;
  referencia: string | null;
  estado: EstadoServicio;
  eta_minutos: number | null;
  motivo_cancelacion: string | null;
  creado_en: string;
  aceptado_en: string | null;
  en_camino_en: string | null;
  llegada_en: string | null;
  inicio_trabajo_en: string | null;
  finalizado_en: string | null;
  cancelado_en: string | null;
  actualizado_en: string;
  categoria: { codigo: string; nombre: string; icono: string | null } | null;
  mecanico: {
    id: string;
    nombre_taller: string | null;
    perfil: { nombre_completo: string; telefono: string | null } | null;
  } | null;
  historial: HitoServicio[] | null;
};

function aServicio(fila: FilaServicio): Servicio {
  const historial = [...(fila.historial ?? [])].sort((a, b) =>
    a.ocurrido_en.localeCompare(b.ocurrido_en),
  );

  // Quién canceló sale de la bitácora: si el actor no es el cliente, fue el mecánico.
  const cancelacion = historial.find((h) => h.estado_nuevo === 'cancelada');
  const canceladoPor: ActorCancelacion | null = !cancelacion
    ? null
    : cancelacion.actor_id && cancelacion.actor_id !== fila.cliente_id
      ? 'mecanico'
      : 'cliente';

  return {
    id: fila.id,
    codigo: fila.codigo,
    cliente_id: fila.cliente_id,
    mecanico_id: fila.mecanico_id,
    mecanico: fila.mecanico
      ? {
          id: fila.mecanico.id,
          nombre: fila.mecanico.nombre_taller ?? fila.mecanico.perfil?.nombre_completo ?? null,
          telefono: fila.mecanico.perfil?.telefono ?? null,
        }
      : null,
    categoria_id: fila.categoria_id,
    categoria_codigo: fila.categoria?.codigo ?? null,
    categoria_nombre: fila.categoria?.nombre ?? 'Asistencia mecánica',
    categoria_icono: fila.categoria?.icono ?? null,
    descripcion: fila.descripcion,
    ubicacion: {
      latitud: Number(fila.latitud),
      longitud: Number(fila.longitud),
      direccion: fila.direccion,
      localidad: fila.localidad,
      referencia: fila.referencia,
    },
    estado: fila.estado,
    eta_minutos: fila.eta_minutos,
    motivo_cancelacion: fila.motivo_cancelacion,
    cancelado_por: canceladoPor,
    creado_en: fila.creado_en,
    aceptado_en: fila.aceptado_en,
    en_camino_en: fila.en_camino_en,
    llegada_en: fila.llegada_en,
    inicio_trabajo_en: fila.inicio_trabajo_en,
    finalizado_en: fila.finalizado_en,
    cancelado_en: fila.cancelado_en,
    actualizado_en: fila.actualizado_en,
    historial,
  };
}

/** Solicitudes creadas por el usuario autenticado, de la más reciente a la más antigua. */
export async function listarSolicitudes(): Promise<Servicio[]> {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabase
    .from('servicios')
    .select(COLUMNAS)
    .eq('cliente_id', usuarioId)
    .order('creado_en', { ascending: false });

  if (error) lanzar(error, 'No se pudieron cargar tus solicitudes');
  return (data as unknown as FilaServicio[]).map(aServicio);
}

/** Bandeja del mecánico: lo que tiene asignado y lo que espera un mecánico. */
export async function listarSolicitudesMecanico(
  mecanicoId: string,
): Promise<{ asignadas: Servicio[]; disponibles: Servicio[] }> {
  const [asignadas, disponibles] = await Promise.all([
    supabase
      .from('servicios')
      .select(COLUMNAS)
      .eq('mecanico_id', mecanicoId)
      .order('creado_en', { ascending: false }),
    supabase
      .from('servicios')
      .select(COLUMNAS)
      .eq('estado', 'solicitado')
      .is('mecanico_id', null)
      .order('creado_en', { ascending: true }),
  ]);

  if (asignadas.error) lanzar(asignadas.error, 'No se pudieron cargar tus servicios');
  if (disponibles.error) lanzar(disponibles.error, 'No se pudieron cargar las solicitudes disponibles');

  return {
    asignadas: (asignadas.data as unknown as FilaServicio[]).map(aServicio),
    disponibles: (disponibles.data as unknown as FilaServicio[]).map(aServicio),
  };
}

export async function obtenerSolicitud(id: string): Promise<Servicio | null> {
  const { data, error } = await supabase
    .from('servicios')
    .select(COLUMNAS)
    .eq('id', id)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo cargar la solicitud');
  return data ? aServicio(data as unknown as FilaServicio) : null;
}

/** Solicitud en curso del usuario autenticado, si la hay. */
export async function obtenerSolicitudActiva(): Promise<Servicio | null> {
  const usuarioId = await obtenerUsuarioId();

  const { data, error } = await supabase
    .from('servicios')
    .select(COLUMNAS)
    .eq('cliente_id', usuarioId)
    .in('estado', ESTADOS_ACTIVOS)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo consultar tu solicitud en curso');
  return data ? aServicio(data as unknown as FilaServicio) : null;
}

/**
 * Guarda una solicitud para el usuario autenticado y devuelve su id. La base
 * rechaza una segunda solicitud activa del mismo cliente (RN-010).
 */
export async function crearSolicitud(datos: {
  categoriaId: string;
  descripcion: string;
  ubicacion: UbicacionServicio;
}): Promise<string> {
  const usuarioId = await obtenerUsuarioId();

  // Código, estado, mecánico y marcas temporales los completa la base.
  const { data, error } = await supabase
    .from('servicios')
    .insert({
      cliente_id: usuarioId,
      categoria_id: datos.categoriaId,
      descripcion: datos.descripcion.trim() || null,
      direccion: datos.ubicacion.direccion.trim(),
      localidad: datos.ubicacion.localidad,
      referencia: datos.ubicacion.referencia?.trim() || null,
      latitud: datos.ubicacion.latitud,
      longitud: datos.ubicacion.longitud,
    })
    .select('id')
    .single();

  if (error) lanzar(error, 'No se pudo guardar la solicitud');
  return data.id as string;
}

/**
 * Registra un cambio de estado con su observación mediante
 * `cambiar_estado_servicio()`: la base valida quién puede hacerlo y la
 * transición (RN-004), completa las marcas temporales y escribe la bitácora.
 */
export async function cambiarEstadoSolicitud(
  id: string,
  estado: EstadoServicio,
  opciones: { observacion?: string; etaMinutos?: number | null } = {},
): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado_servicio', {
    p_servicio_id: id,
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
    .channel(`servicios-${id ?? 'todos'}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'servicios', ...(id ? { filter: `id=eq.${id}` } : {}) },
      alCambiar,
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'servicio_estados',
        ...(id ? { filter: `servicio_id=eq.${id}` } : {}),
      },
      alCambiar,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
