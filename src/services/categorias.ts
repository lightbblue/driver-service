
import { supabase } from '@/lib/supabase';
import type { CategoriaAveria } from '@/types';

export async function listarCategoriasAveria(): Promise<CategoriaAveria[]> {
  console.log('[CATEGORIAS] Iniciando consulta a Supabase');

  const { data, error } = await supabase
    .from('categorias_averia')
    .select('id, nombre, descripcion, icono')
    .order('nombre');

  console.log('[CATEGORIAS] Resultado:', {
    cantidad: data?.length ?? 0,
    error: error?.message ?? null,
    datos: data,
  });

  if (error) {
    throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  }

  return (data ?? []).map((categoria, index) => ({
    id: categoria.id,
    codigo: categoria.nombre,
    nombre: categoria.nombre,
    descripcion: categoria.descripcion,
    icono: categoria.icono,
    requiere_foto: categoria.nombre === 'Accidente',
    activo: true,
    orden: index + 1,
  }));
}


