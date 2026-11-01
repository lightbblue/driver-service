import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type {
  ActorCancelacion,
  EstadoPago,
  EstadoServicio,
  HitoServicio,
  MedioPago,
  PagoServicio,
  Servicio,
  UbicacionServicio,
} from '@/types';

import { obtenerUsuarioId } from './sesion';

/** Orden del flujo normal del servicio (sin la cancelación). */
export const FLUJO_ESTADOS: EstadoServicio[] = [
  'pendiente',
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

/** RN-009: se puede cancelar mientras el trabajo no haya empezado. */
export function esCancelable(estado: EstadoServicio): boolean {
  return ['pendiente', 'aceptado', 'en_camino', 'llegue'].includes(estado);
}

/**
 * Próximo estado que registra el mecánico asignado, o null si no hay.
 * La base agrupa pasos: aceptar deja la solicitud "en camino" y llegar la deja
 * "trabajando", así que el mecánico ve 3 botones: aceptar, llegué y finalizar.
 * `aceptado` y `llegue` quedan por si hay solicitudes viejas en esos estados.
 */
export function siguienteEstadoMecanico(estado: EstadoServicio): EstadoServicio | null {
  const siguientes: Partial<Record<EstadoServicio, EstadoServicio>> = {
    aceptado: 'en_camino',
    en_camino: 'llegue',
    llegue: 'trabajando',
    trabajando: 'finalizado',
  };
  return siguientes[estado] ?? null;
}

/** RF-PAY-003: situación del cobro que se muestra en el seguimiento y en las listas. */
export function estadoPago(servicio: Pick<Servicio, 'pago'>): EstadoPago {
  return servicio.pago?.estado ?? 'sin_cobro';
}

const COLUMNAS = `
  id, codigo, usuario_id, mecanico_id, categoria_id, descripcion,
  direccion, latitud, longitud, estado, eta_minutos, motivo_cancelacion,
  monto_final, medio_pago, creado_en, actualizado_en,
  categoria:categorias_averia ( nombre, icono ),
  mecanico:mecanicos ( id, nombre, telefono ),
  pago:pagos ( id, monto, comision, neto_mecanico, medio, estado, actualizado_en ),
  historial:historial_solicitudes ( id, estado_anterior, estado, usuario_id, nota, creado_en )
`;

type FilaPago = {
  id: string;
  monto: number | string;
  comision: number | string;
  neto_mecanico: number | string;
  medio: PagoServicio['medio'];
  estado: PagoServicio['estado'];
  actualizado_en: string;
};

/** `pagos.solicitud_id` es único, pero PostgREST puede devolver la relación como lista. */
function aPago(fila: FilaPago | FilaPago[] | null): PagoServicio | null {
  const pago = Array.isArray(fila) ? fila[0] : fila;
  if (!pago) return null;
  return {
    id: pago.id,
    monto: Number(pago.monto),
    comision: Number(pago.comision),
    neto_mecanico: Number(pago.neto_mecanico),
    medio: pago.medio,
    estado: pago.estado,
    actualizado_en: pago.actualizado_en,
  };
}

type FilaSolicitud = {
  id: string;
  codigo: string;
  usuario_id: string;
  mecanico_id: string | null;
  categoria_id: string | null;
  descripcion: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: EstadoServicio;
  eta_minutos: number | null;
  motivo_cancelacion: string | null;
  monto_final: number | string | null;
  medio_pago: MedioPago;
  creado_en: string;
  actualizado_en: string;
  categoria: { nombre: string; icono: string | null } | null;
  mecanico: { id: string; nombre: string; telefono: string | null } | null;
  pago: FilaPago | FilaPago[] | null;
  historial:
    | {
        id: string;
        estado_anterior: EstadoServicio | null;
        estado: EstadoServicio;
        usuario_id: string | null;
        nota: string | null;
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
      actor_id: h.usuario_id,
      ocurrido_en: h.creado_en,
      observacion: h.nota,
    }))
    .sort((a, b) => a.ocurrido_en.localeCompare(b.ocurrido_en));

  // Quién canceló sale de la bitácora: si el actor no es el cliente, fue el mecánico.
  const cancelacion = historial.find((h) => h.estado_nuevo === 'cancelada');
  const canceladoPor: ActorCancelacion | null = !cancelacion
    ? null
    : cancelacion.actor_id && cancelacion.actor_id !== fila.usuario_id
      ? 'mecanico'
      : 'cliente';

  return {
    id: fila.id,
    codigo: fila.codigo,
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
    },
    estado: fila.estado,
    eta_minutos: fila.eta_minutos,
    motivo_cancelacion: fila.motivo_cancelacion,
    cancelado_por: canceladoPor,
    monto_final: fila.monto_final == null ? null : Number(fila.monto_final),
    medio_pago: fila.medio_pago,
    pago: aPago(fila.pago),
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
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
      .eq('estado', 'pendiente')
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

/**
 * Guarda una solicitud del usuario autenticado (RF-ASSIST-005) y devuelve su
 * id y su código. La base rechaza una segunda solicitud activa (RN-010), fija el
 * monto con la tarifa de la categoría y retiene el cobro (o lo deja pendiente si es efectivo).
 */
export async function crearSolicitud(datos: {
  categoriaId: string;
  descripcion: string;
  ubicacion: UbicacionServicio;
  medioPago: MedioPago;
}): Promise<{ id: string; codigo: string }> {
  const usuarioId = await obtenerUsuarioId();

  // Código, estado, mecánico, monto y cobro los completa la base.
  const { data, error } = await supabase
    .from('solicitudes')
    .insert({
      usuario_id: usuarioId,
      categoria_id: datos.categoriaId,
      descripcion: datos.descripcion.trim() || null,
      direccion: datos.ubicacion.direccion.trim(),
      latitud: datos.ubicacion.latitud,
      longitud: datos.ubicacion.longitud,
      medio_pago: datos.medioPago,
    })
    .select('id, codigo')
    .single();

  if (error) lanzar(error, 'No se pudo guardar la solicitud');
  return data as { id: string; codigo: string };
}

/**
 * Registra un cambio de estado con su nota mediante `cambiar_estado_solicitud()`:
 * la base valida quién puede hacerlo y la transición (RN-004), y escribe la
 * bitácora (RF-DATA-004). Para pasar a *finalizado* exige el monto final (RN-014).
 */
export async function cambiarEstadoSolicitud(
  id: string,
  estado: EstadoServicio,
  opciones: { observacion?: string; etaMinutos?: number | null; montoFinal?: number | null } = {},
): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado_solicitud', {
    p_solicitud_id: id,
    p_estado: estado,
    p_nota: opciones.observacion?.trim() || null,
    p_eta_minutos: opciones.etaMinutos ?? null,
    p_monto_final: opciones.montoFinal ?? null,
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
    // RF-PAY-003: el estado del cobro (retenido, cobrado, devuelto) cambia con la solicitud.
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pagos', ...(id ? { filter: `solicitud_id=eq.${id}` } : {}) },
      alCambiar,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
