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
  /** Texto del hito en la línea de tiempo del seguimiento. */
  hito: string;
  icono: NombreIcono;
  /** Clase de NativeWind del tema, nunca un color literal. */
  color: string;
  /** El mismo color para los íconos, que no aceptan clases. */
  colorIcono: string;
};

const ACENTO = '#FFC107';
const EXITO = '#22C55E';
const PELIGRO = '#EF4444';

const ESTADOS: Record<EstadoServicio, DescriptorEstado> = {
  pendiente: { etiqueta: 'Buscando mecánico', hito: 'Solicitud enviada', icono: 'paper-plane-outline', color: 'text-acento', colorIcono: ACENTO },
  aceptado: { etiqueta: 'Aceptada', hito: 'El mecánico aceptó', icono: 'person-add-outline', color: 'text-acento', colorIcono: ACENTO },
  en_camino: { etiqueta: 'Mecánico en camino', hito: 'En camino', icono: 'bicycle-outline', color: 'text-exito', colorIcono: EXITO },
  llegue: { etiqueta: 'Mecánico en el lugar', hito: 'Llegó al lugar', icono: 'flag-outline', color: 'text-exito', colorIcono: EXITO },
  trabajando: { etiqueta: 'Trabajo en curso', hito: 'Inició el trabajo', icono: 'build-outline', color: 'text-acento', colorIcono: ACENTO },
  finalizado: { etiqueta: 'Finalizado', hito: 'Trabajo finalizado', icono: 'checkmark-circle-outline', color: 'text-exito', colorIcono: EXITO },
  cancelada: { etiqueta: 'Cancelada', hito: 'Solicitud cancelada', icono: 'close-circle-outline', color: 'text-peligro', colorIcono: PELIGRO },
};

export function descriptorEstado(estado: EstadoServicio): DescriptorEstado {
  return ESTADOS[estado] ?? ESTADOS.pendiente;
}
