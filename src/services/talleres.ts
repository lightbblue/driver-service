import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { FotoTaller, MiembroTaller, MiTaller, ResenaTaller, UbicacionServicio } from '@/types';

import { obtenerSesion } from './sesion';

type FilaMiTaller = Omit<MiTaller, 'especialidades'> & { especialidades: string[] | null };

/** El taller del mecánico autenticado (o al que pidió sumarse), o null si trabaja en ruta. */
export async function obtenerMiTaller(): Promise<MiTaller | null> {
  const { data, error } = await supabase.rpc('mi_taller');
  if (error) lanzar(error, 'No se pudo cargar tu taller');
  const fila = (data as FilaMiTaller[] | null)?.[0];
  return fila ? { ...fila, especialidades: fila.especialidades ?? [] } : null;
}

/** Mecánicos del taller. El dueño ve también los pedidos para sumarse. */
export async function listarMiembrosTaller(): Promise<MiembroTaller[]> {
  const { data, error } = await supabase.rpc('miembros_mi_taller');
  if (error) lanzar(error, 'No se pudieron cargar los miembros del taller');
  return (data ?? []) as MiembroTaller[];
}

/** Guarda los datos del taller. Solo el dueño (lo controla la base). */
export async function actualizarMiTaller(datos: {
  nombre: string;
  descripcion: string;
  telefono: string;
  localidad: string;
  especialidades: string[];
  ubicacion: UbicacionServicio;
  imagenUrl?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('actualizar_mi_taller', {
    p_nombre: datos.nombre.trim(),
    p_descripcion: datos.descripcion.trim(),
    p_telefono: datos.telefono.trim(),
    p_direccion: datos.ubicacion.direccion.trim(),
    p_localidad: datos.localidad.trim(),
    p_latitud: datos.ubicacion.latitud,
    p_longitud: datos.ubicacion.longitud,
    p_especialidades: datos.especialidades,
    p_imagen_url: datos.imagenUrl ?? null,
  });
  if (error) lanzar(error, 'No se pudieron guardar los datos del taller');
}

/** El dueño acepta o rechaza a un mecánico que pidió sumarse. Al mecánico le llega un aviso. */
export async function responderUnionTaller(mecanicoId: string, aceptar: boolean): Promise<void> {
  const { error } = await supabase.rpc('responder_union_taller', {
    p_mecanico_id: mecanicoId,
    p_aceptar: aceptar,
  });
  if (error) lanzar(error, 'No se pudo responder el pedido');
}

/** El dueño quita a un mecánico del taller: pasa a trabajar en ruta. */
export async function quitarMiembroTaller(mecanicoId: string): Promise<void> {
  const { error } = await supabase.rpc('quitar_miembro_taller', { p_mecanico_id: mecanicoId });
  if (error) lanzar(error, 'No se pudo quitar al mecánico');
}

/** Galería del taller, de la más vieja a la más nueva. Se lee sin sesión. */
export async function listarFotosTaller(tallerId: string): Promise<FotoTaller[]> {
  const { data, error } = await supabase
    .from('fotos_taller')
    .select('id, url')
    .eq('taller_id', tallerId)
    .order('creado_en');
  if (error) lanzar(error, 'No se pudieron cargar las fotos del taller');
  return (data ?? []) as FotoTaller[];
}

/** El dueño suma una foto a la galería (hasta 10). */
export async function agregarFotoTaller(base64: string, mimeType?: string | null): Promise<void> {
  const url = await subirFotoTaller(base64, mimeType, `taller-fotos/${Date.now()}`);
  const { error } = await supabase.rpc('agregar_foto_taller', { p_url: url });
  if (error) lanzar(error, 'No se pudo agregar la foto');
}

/** El dueño saca una foto de la galería. */
export async function eliminarFotoTaller(fotoId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_foto_taller', { p_foto_id: fotoId });
  if (error) lanzar(error, 'No se pudo borrar la foto');
}

/** Reseñas del taller (la propia primero) y si el usuario puede dejar una. */
export async function listarResenasTaller(
  tallerId: string,
): Promise<{ resenas: ResenaTaller[]; puedeResenar: boolean }> {
  const [resenas, permiso] = await Promise.all([
    supabase.rpc('resenas_de_taller', { p_taller_id: tallerId }),
    supabase.rpc('puede_resenar_taller', { p_taller_id: tallerId }),
  ]);
  if (resenas.error) lanzar(resenas.error, 'No se pudieron cargar las reseñas');
  return {
    resenas: ((resenas.data ?? []) as ResenaTaller[]).map((r) => ({ ...r, puntaje: Number(r.puntaje) })),
    puedeResenar: permiso.data === true,
  };
}

/** Deja (o cambia) la reseña del usuario al taller: de 1 a 5 estrellas y un comentario opcional. */
export async function resenarTaller(tallerId: string, puntaje: number, comentario: string): Promise<void> {
  const { error } = await supabase.rpc('resenar_taller', {
    p_taller_id: tallerId,
    p_puntaje: puntaje,
    p_comentario: comentario.trim() || null,
  });
  if (error) lanzar(error, 'No se pudo guardar la reseña');
}

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TAMANIO_MAXIMO = 5 * 1024 * 1024;

/**
 * Sube la foto del taller y devuelve su URL. Va a la carpeta del dueño en el bucket
 * `avatars` (las políticas solo dejan escribir en la propia). Después se guarda con
 * `actualizarMiTaller`.
 */
export async function subirFotoTaller(
  base64: string,
  mimeType?: string | null,
  archivo = 'taller',
): Promise<string> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new Error('Iniciá sesión para cambiar la foto del taller.');

  const tipo = mimeType || 'image/jpeg';
  const extension = EXTENSIONES[tipo];
  if (!extension) throw new Error('La foto debe estar en formato JPG, PNG o WebP.');

  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  if (bytes.byteLength > TAMANIO_MAXIMO) throw new Error('La foto no puede superar los 5 MB.');

  const ruta = `${sesion.user.id}/${archivo}.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(ruta, bytes, { contentType: tipo, upsert: true });
  if (error) lanzar(error, 'No se pudo subir la foto del taller');

  const { data } = supabase.storage.from('avatars').getPublicUrl(ruta);
  // El parámetro evita que se muestre la foto anterior guardada en caché.
  return `${data.publicUrl}?t=${Date.now()}`;
}
