import * as Location from 'expo-location';

import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';

export type Posicion = { latitud: number; longitud: number };

type FilaUbicacion = { latitud: number; longitud: number };

/** Última posición conocida del mecánico de la solicitud, o null si todavía no compartió ninguna. */
export async function obtenerUbicacionMecanico(solicitudId: string): Promise<Posicion | null> {
  const { data, error } = await supabase
    .from('ubicaciones_mecanico')
    .select('latitud, longitud')
    .eq('solicitud_id', solicitudId)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo cargar la ubicación del mecánico');
  return (data as FilaUbicacion | null) ?? null;
}

/** Avisa cada vez que el mecánico de la solicitud se mueve (RF-GPS-001). Devuelve la función para desuscribirse. */
export function suscribirseAUbicacionMecanico(
  solicitudId: string,
  alMoverse: (posicion: Posicion | null) => void,
): () => void {
  const canal = supabase
    .channel(`ubicacion-${solicitudId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ubicaciones_mecanico', filter: `solicitud_id=eq.${solicitudId}` },
      (cambio) => {
        if (cambio.eventType === 'DELETE') {
          alMoverse(null);
          return;
        }
        const fila = cambio.new as FilaUbicacion;
        alMoverse({ latitud: fila.latitud, longitud: fila.longitud });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}

/**
 * El mecánico asignado comparte su posición mientras el servicio está en curso (RF-GPS-002).
 * Pide permiso de ubicación y publica cada ~5 s o 15 m. Devuelve la función para dejar de compartir.
 */
export async function compartirUbicacionMecanico(
  solicitudId: string,
  alPublicar?: (posicion: Posicion) => void,
): Promise<() => void> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (permiso.status !== 'granted') {
    throw new Error('Para que el cliente vea por dónde venís, permití el acceso a tu ubicación.');
  }

  const publicar = async (latitud: number, longitud: number) => {
    alPublicar?.({ latitud, longitud });
    const { error } = await supabase.rpc('actualizar_ubicacion_mecanico', {
      p_solicitud_id: solicitudId,
      p_latitud: latitud,
      p_longitud: longitud,
    });
    if (error) console.warn('[UBICACION] No se pudo compartir la posición:', error.message);
  };

  const suscripcion = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
    (posicion) => void publicar(posicion.coords.latitude, posicion.coords.longitude),
  );

  return () => suscripcion.remove();
}
