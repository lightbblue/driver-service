import type { Ionicons } from '@expo/vector-icons';

import type { NombreColor } from '@/lib/tema';
import type { EstadoServicio } from '@/types';

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * Traduce el `icono` que viaja en los datos al ícono de la librería.
 * Vive en la interfaz, no en los datos: agregar una categoría no obliga a
 * tocar componentes, solo a declarar su ícono acá (RNF-SCAL-002).
 */
const ICONOS_CATEGORIA: Record<string, NombreIcono> = {
  engine: 'construct-outline',
  tire: 'ellipse-outline',
  battery: 'battery-half-outline',
  fuel: 'speedometer-outline',
  key: 'key-outline',
  chain: 'link-outline',
  crash: 'warning-outline',
  alert: 'alert-circle-outline',
};

export function iconoDeCategoria(codigo: string): NombreIcono {
  return ICONOS_CATEGORIA[codigo] ?? 'help-circle-outline';
}

type DescriptorEstado = {
  etiqueta: string;
  icono: NombreIcono;
  /** Clase de NativeWind del tema, nunca un color literal. */
  color: string;
  /** Token del tema para los íconos, que no aceptan clases. */
  tono: NombreColor;
};

const ESTADOS: Record<EstadoServicio, DescriptorEstado> = {
  pendiente: { etiqueta: 'Esperando mecánico', icono: 'time-outline', color: 'text-acento', tono: 'acento' },
  solicitado: { etiqueta: 'Solicitud enviada', icono: 'paper-plane-outline', color: 'text-acento', tono: 'acento' },
  aceptado: { etiqueta: 'Mecánico asignado', icono: 'person-add-outline', color: 'text-acento', tono: 'acento' },
  en_camino: { etiqueta: 'Mecánico en camino', icono: 'bicycle-outline', color: 'text-exito', tono: 'exito' },
  llegue: { etiqueta: 'En el lugar', icono: 'flag-outline', color: 'text-exito', tono: 'exito' },
  trabajando: { etiqueta: 'Trabajando', icono: 'build-outline', color: 'text-acento', tono: 'acento' },
  finalizado: { etiqueta: 'Finalizado', icono: 'checkmark-circle-outline', color: 'text-exito', tono: 'exito' },
  cancelada: { etiqueta: 'Cancelada', icono: 'close-circle-outline', color: 'text-peligro', tono: 'peligro' },
};

/** Si la base trae un estado desconocido, se muestra como pendiente en vez de romper la vista. */
export function descriptorEstado(estado: EstadoServicio): DescriptorEstado {
  return ESTADOS[estado] ?? ESTADOS.pendiente;
}
