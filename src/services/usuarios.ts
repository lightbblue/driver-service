import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/types';

export async function obtenerUsuarioActual(): Promise<Perfil | null> {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const usuario = authData.user;

  if (!usuario) {
    return null;
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono, avatar_url, creado_en')
    .eq('id', usuario.id)
    .maybeSingle();

  if (perfilError) {
    throw perfilError;
  }

  const nombre =
    perfil?.nombre ||
    usuario.user_metadata?.nombre ||
    '';

  const fechaCreacion =
    perfil?.creado_en || usuario.created_at;

  return {
    id: usuario.id,
    nombre_completo: nombre,
    email: usuario.email ?? '',
    telefono:
      perfil?.telefono ??
      usuario.user_metadata?.telefono ??
      null,
    rol: 'cliente',
    avatar_url: perfil?.avatar_url ?? null,
    localidad: null,
    provincia: null,
    creado_en: fechaCreacion,
    estadisticas: {
      solicitudes: 0,
      resueltas: 0,
      calificacion: null,
      miembro_desde: new Date(fechaCreacion).getFullYear(),
    },
  };
}

export async function obtenerUsuario(
  id: string,
): Promise<Perfil | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user || data.user.id !== id) {
    return null;
  }

  return obtenerUsuarioActual();
}
