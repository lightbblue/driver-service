import consejosJson from '@/data/consejos.json';
import promocionesJson from '@/data/promociones.json';
import type { Consejo, Promocion } from '@/types';

import { leer } from './cliente-local';

/** Carrusel de consejos del Home (RF-VIEW-004). */
export async function listarConsejos(): Promise<Consejo[]> {
  return leer(consejosJson as Consejo[]);
}

/** Carrusel promocional del Home (RF-VIEW-004). */
export async function listarPromociones(): Promise<Promocion[]> {
  return leer(promocionesJson as Promocion[]);
}
