/**
 * Colores del tema para las props que no aceptan clases de NativeWind
 * (por ejemplo `color` de Ionicons o de ActivityIndicator).
 *
 * Son los mismos tokens de `tailwind.config.js`: si cambia uno, cambian los dos.
 */
export const COLORES = {
  fondo: '#0B0B0D',
  superficie: '#16161A',
  superficieAlta: '#1F1F25',
  borde: '#2A2A32',
  acento: '#FFC107',
  texto: '#FFFFFF',
  textoTenue: '#9CA3AF',
  textoSutil: '#6B7280',
  textoInverso: '#0B0B0D',
  exito: '#22C55E',
  peligro: '#EF4444',
  info: '#3B82F6',
} as const;

export type NombreColor = keyof typeof COLORES;
