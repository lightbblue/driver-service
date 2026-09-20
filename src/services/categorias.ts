import datos from '@/data/categorias-averia.json';
import type { CategoriaAveria } from '@/types';

import { leer } from './cliente-local';

const CATEGORIAS = datos as CategoriaAveria[];

/** Catálogo de tipos de avería (RF-VIEW-006, paso 1). */
export async function listarCategoriasAveria(): Promise<CategoriaAveria[]> {
  const activas = CATEGORIAS.filter((c) => c.activo).sort((a, b) => a.orden - b.orden);
  return leer(activas);
}
