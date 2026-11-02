import type { Ionicons } from '@expo/vector-icons';

import type { Servicio, TipoVehiculo } from '@/types';

export const NOMBRE_VEHICULO: Record<TipoVehiculo, string> = {
  auto: 'Auto',
  moto: 'Moto',
};

export function iconoVehiculo(tipo: TipoVehiculo | null): keyof typeof Ionicons.glyphMap {
  return tipo === 'moto' ? 'bicycle-outline' : 'car-sport-outline';
}

/** "Auto · Ford Fiesta 2015", o null en solicitudes viejas que no lo tienen. */
export function textoVehiculo(servicio: Pick<Servicio, 'tipo_vehiculo' | 'vehiculo_modelo'>): string | null {
  if (!servicio.tipo_vehiculo) return null;
  const modelo = servicio.vehiculo_modelo?.trim();
  return modelo ? `${NOMBRE_VEHICULO[servicio.tipo_vehiculo]} · ${modelo}` : NOMBRE_VEHICULO[servicio.tipo_vehiculo];
}
