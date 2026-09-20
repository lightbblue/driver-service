import type { Ionicons } from '@expo/vector-icons';

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
};

const ESTADOS: Record<EstadoServicio, DescriptorEstado> = {
  solicitado: { etiqueta: 'Solicitud enviada', icono: 'paper-plane-outline', color: 'text-acento' },
  aceptado: { etiqueta: 'Mecánico asignado', icono: 'person-add-outline', color: 'text-acento' },
  en_camino: { etiqueta: 'Mecánico en camino', icono: 'bicycle-outline', color: 'text-exito' },
  llegue: { etiqueta: 'En el lugar', icono: 'flag-outline', color: 'text-exito' },
  trabajando: { etiqueta: 'Trabajando', icono: 'build-outline', color: 'text-acento' },
  finalizado: { etiqueta: 'Finalizado', icono: 'checkmark-circle-outline', color: 'text-exito' },
  cancelada: { etiqueta: 'Cancelada', icono: 'close-circle-outline', color: 'text-peligro' },
};

export function descriptorEstado(estado: EstadoServicio): DescriptorEstado {
  return ESTADOS[estado];
}
