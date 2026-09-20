import datos from '@/data/solicitudes.json';
import type { EstadoServicio, Servicio } from '@/types';

import { leer } from './cliente-local';

const SOLICITUDES = datos as Servicio[];

const ESTADOS_ACTIVOS: EstadoServicio[] = [
  'solicitado',
  'aceptado',
  'en_camino',
  'llegue',
  'trabajando',
];

export function esEstadoActivo(estado: EstadoServicio): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

export async function listarSolicitudes(): Promise<Servicio[]> {
  const ordenadas = [...SOLICITUDES].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
  return leer(ordenadas);
}

export async function obtenerSolicitud(codigo: string): Promise<Servicio | null> {
  return leer(SOLICITUDES.find((s) => s.codigo === codigo || s.id === codigo) ?? null);
}

/** Solicitud en curso del usuario de ejemplo, si la hay. */
export async function obtenerSolicitudActiva(): Promise<Servicio | null> {
  return leer(SOLICITUDES.find((s) => esEstadoActivo(s.estado)) ?? null);
}
