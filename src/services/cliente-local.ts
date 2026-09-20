/**
 * Origen de datos de la Entrega 1: archivos JSON locales.
 *
 * Es el único módulo que conoce de dónde vienen los datos. En la Entrega 2 se
 * reemplaza por el cliente de Supabase y ninguna vista cambia (RNF-SCAL-001).
 */

/** Latencia simulada: obliga a que las pantallas contemplen el estado de carga (RNF-UX-003). */
const LATENCIA_MS = 250;

export async function leer<T>(datos: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, LATENCIA_MS));
  return datos;
}
