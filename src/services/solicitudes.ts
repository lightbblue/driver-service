
import datos from '@/data/solicitudes.json';
import { supabase } from '@/lib/supabase';
import type {
  EstadoServicio,
  Servicio,
  UbicacionServicio,
} from '@/types';
import { leer } from './cliente-local';

const SOLICITUDES = datos as Servicio[];

const ESTADOS_ACTIVOS: EstadoServicio[] = [
  'solicitado',
  'aceptado',
  'en_camino',
  'llegue',
  'trabajando',
];

export function esEstadoActivo(estado: EstadoServicio): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

export async function listarSolicitudes(): Promise<Servicio[]> {
  const ordenadas = [...SOLICITUDES].sort((a, b) =>
    b.creado_en.localeCompare(a.creado_en),
  );

  return leer(ordenadas);
}

export async function obtenerSolicitud(
  codigo: string,
): Promise<Servicio | null> {
  return leer(
    SOLICITUDES.find(
      (s) => s.codigo === codigo || s.id === codigo,
    ) ?? null,
  );
}

export async function obtenerSolicitudActiva(): Promise<Servicio | null> {
  return leer(
    SOLICITUDES.find((s) => esEstadoActivo(s.estado)) ?? null,
  );
}

/** Guarda una solicitud en Supabase para el usuario autenticado. */
export async function crearSolicitud(datos: {
  categoriaId: string;
  descripcion: string;
  ubicacion: UbicacionServicio;
}): Promise<string> {
  console.log('[SOLICITUD] Iniciando guardado en Supabase');

  try {
    const {
      data: usuarioData,
      error: errorUsuario,
    } = await supabase.auth.getUser();

    console.log('[SOLICITUD] Estado de autenticación:', {
      hayUsuario: !!usuarioData.user,
      error: errorUsuario?.message ?? null,
    });

    if (errorUsuario) {
      throw new Error(
        `Error al verificar la sesión: ${errorUsuario.message}`,
      );
    }

    if (!usuarioData.user) {
      throw new Error(
        'No hay una sesión iniciada. Cerrá sesión e iniciá sesión nuevamente antes de pedir asistencia.',
      );
    }

    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        usuario_id: usuarioData.user.id,
        categoria_id: datos.categoriaId,
        descripcion: datos.descripcion.trim() || null,
        direccion: datos.ubicacion.direccion,
        latitud: datos.ubicacion.latitud,
        longitud: datos.ubicacion.longitud,
        estado: 'pendiente',
      })
      .select('id')
      .single();

    console.log('[SOLICITUD] Resultado del guardado:', {
      guardada: !!data,
      error: error?.message ?? null,
      codigoError: error?.code ?? null,
    });

    if (error) {
      throw new Error(
        `No se pudo guardar la solicitud: ${error.message}`,
      );
    }

    if (!data?.id) {
      throw new Error(
        'Supabase no devolvió el identificador de la solicitud.',
      );
    }

    console.log('[SOLICITUD] Solicitud guardada correctamente:', data.id);

    return data.id;
  } catch (error) {
    console.error('[SOLICITUD] Error al guardar:', error);
    throw error;
  }
}


/** Cancela una solicitud propia usando la sesión autenticada. */
export async function cancelarSolicitud(
  solicitudId: string,
  motivo = 'Cancelación de solicitud de prueba',
): Promise<void> {
  const { data: usuarioData, error: errorUsuario } =
    await supabase.auth.getUser();

  if (errorUsuario || !usuarioData.user) {
    throw new Error('Iniciá sesión para cancelar la solicitud.');
  }

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
