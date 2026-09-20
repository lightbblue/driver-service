import datos from '@/data/usuarios.json';
import type { Perfil } from '@/types';

import { leer } from './cliente-local';

const USUARIOS = datos as Perfil[];

/**
 * Perfil del usuario de ejemplo de la Entrega 1.
 * En E2 devuelve el perfil de la sesión autenticada (RF-PROF-001).
 */
export async function obtenerUsuarioActual(): Promise<Perfil | null> {
  return leer(USUARIOS[0] ?? null);
}

export async function obtenerUsuario(id: string): Promise<Perfil | null> {
  return leer(USUARIOS.find((u) => u.id === id) ?? null);
}
