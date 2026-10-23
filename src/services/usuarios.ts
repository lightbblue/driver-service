
import type { Perfil, RolUsuario } from '@/types';

import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import { obtenerSesion } from './sesion';

/**
 * Obtiene el perfil de la cuenta autenticada desde Supabase.
 * No utiliza usuarios de ejemplo para representar una sesión real.
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

/**
 * Actualiza únicamente los datos personales permitidos del usuario autenticado.
 * La sesión determina qué perfil se modifica; las políticas RLS de Supabase
 * deben impedir el acceso a perfiles de otras cuentas.
 */
export async function actualizarPerfil(datos: {
  nombre: string;
  telefono: string;
}): Promise<void> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    throw new Error('No hay una sesión iniciada. Iniciá sesión nuevamente.');
  }

  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();

  if (!nombre) {
    throw new Error('El nombre es obligatorio.');
  }

  if (nombre.length > 100) {
    throw new Error('El nombre no puede superar los 100 caracteres.');
  }

  if (telefono.length > 30) {
    throw new Error('El teléfono no puede superar los 30 caracteres.');
  }

  const { data, error } = await supabase
    .from('perfiles')
    .update({
      nombre,
      telefono: telefono || null,
    })
    .eq('id', sesion.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    lanzar(error, 'No se pudieron guardar los cambios del perfil');
  }

  if (!data) {
    throw new Error(
      'No se encontró tu perfil para actualizar. Iniciá sesión nuevamente e intentá otra vez.',
    );
  }
}

/**
 * Sube la foto del usuario autenticado y guarda su URL en el perfil.
 */
export async function actualizarFotoPerfil(
  uri: string,
  mimeType?: string | null,
): Promise<string> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    throw new Error('Iniciá sesión para cambiar tu foto de perfil.');
  }

  const tipo = mimeType || 'image/jpeg';
  const extensiones: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensiones[tipo];

  if (!extension) {
    throw new Error('La foto debe estar en formato JPG, PNG o WebP.');
  }

  console.log('[FOTO] Leyendo imagen:', uri);
  const respuesta = await fetch(uri);
  if (!respuesta.ok) {
    throw new Error('No se pudo leer la imagen seleccionada.');
  }

  const archivo = await respuesta.blob();
  console.log('[FOTO] Imagen leída:', archivo.size, 'bytes', archivo.type);

  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error('La foto no puede superar los 5 MB.');
  }

  const ruta = `${sesion.user.id}/avatar.${extension}`;

  console.log('[FOTO] Iniciando subida:', ruta);

  const bytes = await archivo.arrayBuffer();
  console.log('[FOTO] Bytes preparados:', bytes.byteLength);

  const resultadoSubida = await Promise.race([
    supabase.storage
      .from('avatars')
      .upload(ruta, bytes, {
        contentType: tipo,
        upsert: true,
      }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('La subida tardó demasiado. Revisá la conexión y las políticas de Storage.')),
        20000,
      ),
    ),
  ]);

  const { error: errorSubida } = resultadoSubida;

  if (errorSubida) {
    console.error('[FOTO] Detalle del error:', {
      name: errorSubida.name,
      message: errorSubida.message,
      status: errorSubida.status,
    });
    lanzar(errorSubida, 'No se pudo subir la foto');
  }

  console.log('[FOTO] Subida completada');
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(ruta);

  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  console.log('[FOTO] Guardando URL en perfil');
  const { data, error } = await supabase
    .from('perfiles')
    .update({ avatar_url: url })
    .eq('id', sesion.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    lanzar(error, 'No se pudo guardar la foto en tu perfil');
  }

  if (!data) {
    throw new Error('No se encontró tu perfil para guardar la foto.');
  }

  return url;
}
