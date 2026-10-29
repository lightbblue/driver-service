import { supabase } from '@/lib/supabase';
import type {
  DetalleSolicitud,
  EstadoServicio,
  HitoServicio,
  MecanicoAsignado,
  Servicio,
  UbicacionServicio,
} from '@/types';

/** Estados en los que la solicitud sigue abierta. */
const ESTADOS_ACTIVOS: EstadoServicio[] = [
  'pendiente',
  'solicitado',
  'aceptado',
  'en_camino',
  'llegue',
  'trabajando',
];

/** Solo se puede cancelar antes de que el mecánico empiece a trabajar (RN-009). */
const ESTADOS_CANCELABLES: EstadoServicio[] = [
  'pendiente',
  'solicitado',
  'aceptado',
  'en_camino',
  'llegue',
];

export function esEstadoActivo(estado: EstadoServicio): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

export function esCancelable(estado: EstadoServicio): boolean {
  return ESTADOS_CANCELABLES.includes(estado);
}

/** Fila de `solicitudes` con sus relaciones, tal como la devuelve Supabase. */
type FilaSolicitud = {
  id: string;
  codigo: string | null;
  usuario_id: string;
  mecanico_id: string | null;
  descripcion: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: EstadoServicio;
  eta_minutos: number | null;
  creado_en: string;
  categorias_averia: { nombre: string } | null;
  historial_solicitudes?: { estado: EstadoServicio; nota: string | null; creado_en: string }[];
  mecanicos?: MecanicoAsignado | null;
};

const CAMPOS_SOLICITUD =
  'id, codigo, usuario_id, mecanico_id, descripcion, direccion, latitud, longitud, estado, eta_minutos, creado_en, categorias_averia(nombre)';

async function usuarioActualId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('Iniciá sesión para consultar tus solicitudes.');
  }

  return data.user.id;
}

function aServicio(fila: FilaSolicitud): Servicio {
  const historial: HitoServicio[] = [...(fila.historial_solicitudes ?? [])]
    .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
    .map((hito) => ({
      estado_nuevo: hito.estado,
      ocurrido_en: hito.creado_en,
      observacion: hito.nota,
    }));

  const finalizado = historial.find((hito) => hito.estado_nuevo === 'finalizado');

  return {
    id: fila.id,
    codigo: fila.codigo ?? fila.id.slice(0, 8).toUpperCase(),
    cliente_id: fila.usuario_id,
    mecanico_id: fila.mecanico_id,
    categoria_codigo: fila.categorias_averia?.nombre ?? '',
    categoria_nombre: fila.categorias_averia?.nombre ?? 'Asistencia mecánica',
    descripcion: fila.descripcion,
    ubicacion: {
      latitud: fila.latitud ?? 0,
      longitud: fila.longitud ?? 0,
      direccion: fila.direccion ?? 'Sin dirección registrada',
      localidad: null,
      referencia: null,
    },
    estado: fila.estado,
    eta_minutos: fila.eta_minutos,
    creado_en: fila.creado_en,
    finalizado_en: finalizado?.ocurrido_en ?? null,
    historial,
  };
}

/** Solicitudes del usuario autenticado, de la más nueva a la más vieja. */
export async function listarSolicitudes(): Promise<Servicio[]> {
  const usuarioId = await usuarioActualId();

  const { data, error } = await supabase
    .from('solicitudes')
    .select(CAMPOS_SOLICITUD)
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron cargar las solicitudes: ${error.message}`);
  }

  return ((data ?? []) as unknown as FilaSolicitud[]).map(aServicio);
}

/** Detalle de una solicitud propia, con su historial de estados y el mecánico asignado. */
export async function obtenerSolicitud(id: string): Promise<DetalleSolicitud | null> {
  await usuarioActualId();

  const { data, error } = await supabase
    .from('solicitudes')
    .select(
      `${CAMPOS_SOLICITUD}, historial_solicitudes(estado, nota, creado_en), mecanicos(id, nombre, localidad, telefono, imagen_url)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar la solicitud: ${error.message}`);
  }

  if (!data) return null;

  const fila = data as unknown as FilaSolicitud;
  return { ...aServicio(fila), mecanico: fila.mecanicos ?? null };
}

/** Solicitud abierta del usuario, si tiene alguna. */
export async function obtenerSolicitudActiva(): Promise<Servicio | null> {
  const solicitudes = await listarSolicitudes();
  return solicitudes.find((s) => esEstadoActivo(s.estado)) ?? null;
}

/** Guarda una solicitud en Supabase para el usuario autenticado y devuelve su id. */
export async function crearSolicitud(datos: {
  categoriaId: string;
  descripcion: string;
  ubicacion: UbicacionServicio;
}): Promise<string> {
  const usuarioId = await usuarioActualId();

  const { data, error } = await supabase
    .from('solicitudes')
    .insert({
      usuario_id: usuarioId,
      categoria_id: datos.categoriaId,
      descripcion: datos.descripcion.trim() || null,
      direccion: datos.ubicacion.direccion,
      latitud: datos.ubicacion.latitud,
      longitud: datos.ubicacion.longitud,
      estado: 'pendiente',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`No se pudo guardar la solicitud: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('Supabase no devolvió el identificador de la solicitud.');
  }

  return data.id;
}

/** Cancela una solicitud propia. La base valida que la transición sea posible. */
export async function cancelarSolicitud(
  solicitudId: string,
  motivo = 'Cancelación solicitada por el cliente',
): Promise<void> {
  await usuarioActualId();

  const { error } = await supabase.rpc('cambiar_estado_solicitud', {
    p_solicitud_id: solicitudId,
    p_estado: 'cancelada',
    p_nota: motivo,
    p_eta_minutos: null,
  });

  if (error) {
    throw new Error(`No se pudo cancelar la solicitud: ${error.message}`);
  }
}
