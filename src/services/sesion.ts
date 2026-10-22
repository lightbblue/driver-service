import type { Session } from '@supabase/supabase-js';

import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';

/** Sesión guardada en el dispositivo, o null si no hay usuario autenticado. */
export async function obtenerSesion(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) lanzar(error, 'No se pudo leer la sesión');
  return data.session;
}

/** Id del usuario autenticado. Falla con un mensaje claro si no hay sesión. */
export async function obtenerUsuarioId(): Promise<string> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('No hay una sesión iniciada. Iniciá sesión nuevamente para continuar.');
  }
  return sesion.user.id;
}

/** Id del taller que opera el usuario, o null si no es mecánico. */
export async function obtenerMecanicoIdActual(): Promise<string | null> {
  const { data, error } = await supabase.rpc('mecanico_id_actual');
  if (error) {
    // Sin la migración aplicada la función no existe: el usuario se trata como cliente.
    console.warn('[SESION] No se pudo determinar si el usuario es mecánico:', error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) lanzar(error, 'No se pudo cerrar la sesión');
}

/**
 * Avisa la sesión actual al suscribirse y cada vez que cambia (inicio, cierre,
 * renovación del token). Devuelve la función para desuscribirse.
 */
export function escucharSesion(alCambiar: (sesion: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => alCambiar(sesion));
  return () => data.subscription.unsubscribe();
}
