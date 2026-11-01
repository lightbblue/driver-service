import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { CategoriaAveria } from '@/types';

/** Ícono de la categoría que exige foto (RF-ASSIST-007, Entrega 3). */
const ICONO_ACCIDENTE = 'crash';

/**
 * Catálogo de averías (RF-ASSIST-002). La tabla tiene id, nombre, descripción e
 * ícono; el resto de los campos del tipo se completan acá.
 */
export async function listarCategoriasAveria(): Promise<CategoriaAveria[]> {
  const { data, error } = await supabase
    .from('categorias_averia')
    .select('id, nombre, descripcion, icono, tarifa')
    .order('nombre');

  if (error) lanzar(error, 'No se pudieron cargar las categorías');

  return (data ?? []).map((categoria, indice) => ({
    id: categoria.id as string,
    codigo: categoria.id as string,
    nombre: categoria.nombre as string,
    descripcion: categoria.descripcion as string | null,
    icono: categoria.icono as string,
    tarifa: categoria.tarifa == null ? null : Number(categoria.tarifa),
    requiere_foto: categoria.icono === ICONO_ACCIDENTE,
    activo: true,
    orden: indice + 1,
  }));
}
