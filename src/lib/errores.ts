/**
 * Traduce los errores de Supabase y de red a un mensaje para el usuario.
 *
 * Los errores que lanza la base con `raise exception` ya vienen redactados en
 * castellano (ver `cambiar_estado_solicitud`) y se muestran tal cual.
 */

type ErrorSupabase = { message?: string; code?: string };

export function mensajeDeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  const { message = '', code = '' } = (error ?? {}) as ErrorSupabase;
  const texto = message.toLowerCase();

  if (texto.includes('network request failed') || texto.includes('failed to fetch')) {
    return 'No hay conexión con el servidor. Revisá tu conexión a internet e intentá nuevamente.';
  }

  if (code === 'PGRST301' || texto.includes('jwt expired') || texto.includes('invalid jwt')) {
    return 'Tu sesión venció. Iniciá sesión nuevamente.';
  }

  // 42501: la política RLS rechazó la operación.
  if (code === '42501' || texto.includes('row-level security')) {
    return 'No tenés permiso para realizar esta operación.';
  }

  // P0001: excepción propia de una función de la base.
  if (code === 'P0001' && message) {
    return message;
  }

  return message || porDefecto;
}

/** Relanza el error de Supabase con un mensaje ya listo para mostrar. */
export function lanzar(error: unknown, contexto: string): never {
  throw new Error(`${contexto}: ${mensajeDeError(error)}`);
}
