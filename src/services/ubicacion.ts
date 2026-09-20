import datos from '@/data/ubicacion.json';
import type { UbicacionServicio } from '@/types';

import { leer } from './cliente-local';

/**
 * Ubicación de ejemplo del flujo de solicitud.
 * En E3 la reemplaza la lectura real del GPS con `expo-location` (RF-ASSIST-003),
 * y esta misma función sigue siendo la que consume la vista.
 */
export async function obtenerUbicacionActual(): Promise<UbicacionServicio> {
  return leer(datos as UbicacionServicio);
}
