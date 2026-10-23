
import type { Perfil, RolUsuario } from '@/types';

import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import { obtenerSesion } from './sesion';

/**
 * Obtiene el perfil de la cuenta autenticada desde Supabase.
 * No utiliza los usuarios de ejemplo para representar una sesión real.
 */
export async function obtenerUsuarioActual(): Promise<Perfil | null> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return null;
  }

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono, avatar_url, creado_en')
    .eq('id', sesion.user.id)
    .maybeSingle();

  if (error) {
    lanzar(error, 'No se pudo cargar tu perfil');
  }

  if (!data) {
    return null;
  }

  const rolMetadata = sesion.user.app_metadata?.rol;
  const rol: RolUsuario =
    rolMetadata === 'mecanico' || rolMetadata === 'admin'
      ? rolMetadata
      : 'cliente';

  return {
    id: data.id,
    nombre_completo: data.nombre || 'Sin nombre',
    email: sesion.user.email ?? '',
    telefono: data.telefono,
    rol,
    avatar_url: data.avatar_url,
    localidad: null,
    provincia: null,
    creado_en: data.creado_en,
    estadisticas: {
      solicitudes: 0,
      resueltas: 0,
      calificacion: null,
      miembro_desde: new Date(data.creado_en).getFullYear(),
    },
  };
}

/**
 * Busca un perfil por id.
 * No devuelve datos de ejemplo como si fueran perfiles reales.
 */
export async function obtenerUsuario(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono, avatar_url, creado_en')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    lanzar(error, 'No se pudo cargar el perfil');
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    nombre_completo: data.nombre || 'Sin nombre',
    email: '',
    telefono: data.telefono,
    rol: 'cliente',
    avatar_url: data.avatar_url,
    localidad: null,
    provincia: null,
    creado_en: data.creado_en,
    estadisticas: {
      solicitudes: 0,
      resueltas: 0,
      calificacion: null,
      miembro_desde: new Date(data.creado_en).getFullYear(),
    },
  };
}

