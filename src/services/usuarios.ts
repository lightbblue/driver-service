import type { User } from '@supabase/supabase-js';

import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { EstadoServicio, EstadisticasPerfil, Perfil, RolUsuario } from '@/types';

import { obtenerSesion } from './sesion';

type FilaPerfil = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  avatar_url: string | null;
  creado_en: string;
};

/** El rol lo guarda el registro en los metadatos de la cuenta (services/auth). */
function rolDe(usuario: User | null): RolUsuario {
  const rol = usuario?.user_metadata?.rol ?? usuario?.app_metadata?.rol;
  return rol === 'mecanico' || rol === 'admin' ? rol : 'cliente';
}

function estadisticasIniciales(creadoEn: string): EstadisticasPerfil {
  return {
    solicitudes: 0,
    resueltas: 0,
    calificacion: null,
    miembro_desde: new Date(creadoEn).getFullYear(),
  };
}

type FiltroSolicitudes = { usuarioId: string } | { mecanicoId: string };

async function contarSolicitudes(
  filtro: FiltroSolicitudes,
  estado?: EstadoServicio,
): Promise<number> {
  let consulta = supabase.from('solicitudes').select('id', { count: 'exact', head: true });

  if ('mecanicoId' in filtro) {
    consulta = consulta.eq('mecanico_id', filtro.mecanicoId);
  } else {
    consulta = consulta.eq('usuario_id', filtro.usuarioId);
  }

  if (estado) consulta = consulta.eq('estado', estado);

  const { count, error } = await consulta;
  if (error) lanzar(error, 'No se pudieron cargar las estadísticas del perfil');
  return count ?? 0;
}

async function obtenerEstadisticas(
  usuarioId: string,
  rol: RolUsuario,
  creadoEn: string,
): Promise<EstadisticasPerfil> {
  let filtro: FiltroSolicitudes = { usuarioId };

  if (rol === 'mecanico') {
    const { data: mecanico, error } = await supabase
      .from('mecanicos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) lanzar(error, 'No se pudieron cargar las estadísticas del mecánico');
    if (!mecanico) return estadisticasIniciales(creadoEn);
    filtro = { mecanicoId: mecanico.id };
  }

  const [solicitudes, resueltas] = await Promise.all([
    contarSolicitudes(filtro),
    contarSolicitudes(filtro, 'finalizado'),
  ]);

  return {
    solicitudes,
    resueltas,
    calificacion: null,
    miembro_desde: new Date(creadoEn).getFullYear(),
  };
}

function aPerfil(
  fila: FilaPerfil,
  usuario: User | null,
  estadisticas = estadisticasIniciales(fila.creado_en),
): Perfil {
  return {
    id: fila.id,
    nombre_completo: fila.nombre || 'Sin nombre',
    email: usuario?.email ?? '',
    telefono: fila.telefono,
    rol: rolDe(usuario),
    avatar_url: fila.avatar_url,
    localidad: null,
    provincia: null,
    creado_en: fila.creado_en,
    estadisticas,
  };
}

/** Perfil de la cuenta autenticada, o null si no hay sesión. */
export async function obtenerUsuarioActual(): Promise<Perfil | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono, avatar_url, creado_en')
    .eq('id', sesion.user.id)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo cargar tu perfil');
  if (!data) return null;

  const rol = rolDe(sesion.user);
  const estadisticas = await obtenerEstadisticas(sesion.user.id, rol, data.creado_en);
  return aPerfil(data as FilaPerfil, sesion.user, estadisticas);
}

/** Busca un perfil por id. Las políticas RLS solo dejan leer el propio. */
export async function obtenerUsuario(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, telefono, avatar_url, creado_en')
    .eq('id', id)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo cargar el perfil');
  if (!data) return null;

  const sesion = await obtenerSesion();
  const usuario = sesion?.user.id === id ? sesion.user : null;
  const estadisticas = usuario
    ? await obtenerEstadisticas(id, rolDe(usuario), data.creado_en)
    : estadisticasIniciales(data.creado_en);
  return aPerfil(data as FilaPerfil, usuario, estadisticas);
}

/**
 * Actualiza los datos personales del usuario autenticado (RF-PROF-002).
 * La sesión determina qué perfil se modifica y RLS impide tocar perfiles ajenos.
 */
export async function actualizarPerfil(datos: { nombre: string; telefono: string }): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('No hay una sesión iniciada. Iniciá sesión nuevamente.');
  }

  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();

  if (!nombre) throw new Error('El nombre es obligatorio.');
  if (nombre.length > 100) throw new Error('El nombre no puede superar los 100 caracteres.');
  if (telefono.length > 30) throw new Error('El teléfono no puede superar los 30 caracteres.');

  const { data, error } = await supabase
    .from('perfiles')
    .update({ nombre, telefono: telefono || null })
    .eq('id', sesion.user.id)
    .select('id')
    .maybeSingle();

  if (error) lanzar(error, 'No se pudieron guardar los cambios del perfil');
  if (!data) {
    throw new Error('No se encontró tu perfil para actualizar. Iniciá sesión nuevamente e intentá otra vez.');
  }
}

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TAMANIO_MAXIMO = 5 * 1024 * 1024;
const LIMITE_SUBIDA_MS = 20000;

/** Convierte la imagen en base64 que entrega el selector a los bytes que se suben. */
function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Sube la foto del usuario autenticado al bucket `avatars` y guarda su URL en el perfil.
 * Recibe la imagen en base64 porque en Android `fetch` no puede leer archivos locales.
 */
export async function actualizarFotoPerfil(base64: string, mimeType?: string | null): Promise<string> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    throw new Error('Iniciá sesión para cambiar tu foto de perfil.');
  }

  const tipo = mimeType || 'image/jpeg';
  const extension = EXTENSIONES[tipo];
  if (!extension) {
    throw new Error('La foto debe estar en formato JPG, PNG o WebP.');
  }

  const bytes = base64ABytes(base64);
  if (bytes.byteLength > TAMANIO_MAXIMO) {
    throw new Error('La foto no puede superar los 5 MB.');
  }

  // Cada usuario escribe solo en su carpeta: lo exigen las políticas del bucket.
  const ruta = `${sesion.user.id}/avatar.${extension}`;

  const { error: errorSubida } = await Promise.race([
    supabase.storage.from('avatars').upload(ruta, bytes, { contentType: tipo, upsert: true }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('La subida tardó demasiado. Revisá la conexión e intentá nuevamente.')),
        LIMITE_SUBIDA_MS,
      ),
    ),
  ]);

  if (errorSubida) lanzar(errorSubida, 'No se pudo subir la foto');

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(ruta);
  // El parámetro evita que el celular muestre la foto anterior guardada en caché.
  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  const { data, error } = await supabase
    .from('perfiles')
    .update({ avatar_url: url })
    .eq('id', sesion.user.id)
    .select('id')
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo guardar la foto en tu perfil');
  if (!data) throw new Error('No se encontró tu perfil para guardar la foto.');

  return url;
}
