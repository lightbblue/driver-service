import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { CategoriaAveria } from '@/types';

/** Catálogo de averías activo, en el orden definido en la base (RF-ASSIST-002). */
export async function listarCategoriasAveria(): Promise<CategoriaAveria[]> {
  const { data, error } = await supabase
    .from('categorias_averia')
    .select('id, codigo, nombre, descripcion, icono, requiere_foto, activo, orden')
    .eq('activo', true)
    .order('orden');

  if (error) lanzar(error, 'No se pudieron cargar las categorías');
  return data as CategoriaAveria[];
}
