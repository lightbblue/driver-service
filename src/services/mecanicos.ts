import datos from '@/data/mecanicos.json';
import type { Mecanico } from '@/types';

import { leer } from './cliente-local';

const MECANICOS = datos as Mecanico[];

/** Listado completo, ordenado por distancia (en E2 lo hace `mecanicos_cercanos()`). */
export async function listarMecanicos(): Promise<Mecanico[]> {
  const ordenados = [...MECANICOS].sort(
    (a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity),
  );
  return leer(ordenados);
}

/** Mecánicos destacados del Home: disponibles y mejor calificados. */
export async function listarMecanicosDestacados(limite = 6): Promise<Mecanico[]> {
  const destacados = MECANICOS.filter((m) => m.disponible)
    .sort((a, b) => (b.calificacion_promedio ?? 0) - (a.calificacion_promedio ?? 0))
    .slice(0, limite);
  return leer(destacados);
}

export async function obtenerMecanico(id: string | null): Promise<Mecanico | null> {
  if (!id) return leer(null);
  return leer(MECANICOS.find((m) => m.id === id) ?? null);
}
