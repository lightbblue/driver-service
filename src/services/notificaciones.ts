import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { Notificacion } from '@/types';

import { obtenerSesion } from './sesion';

const LIMITE = 30;

/** Últimos avisos del usuario autenticado, del más nuevo al más viejo (RF-NOTIF-001). */
export async function listarNotificaciones(): Promise<Notificacion[]> {
  const sesion = await obtenerSesion();
  if (!sesion) return [];

  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, titulo, cuerpo, solicitud_id, tipo, leida, creado_en')
    .eq('usuario_id', sesion.user.id)
    .order('creado_en', { ascending: false })
    .limit(LIMITE);

  if (error) lanzar(error, 'No se pudieron cargar las notificaciones');
  return (data ?? []) as Notificacion[];
}

/** Marca como leídos todos los avisos del usuario autenticado. */
export async function marcarNotificacionesLeidas(): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion) return;

  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', sesion.user.id)
    .eq('leida', false);

  if (error) lanzar(error, 'No se pudieron marcar las notificaciones como leídas');
}

/** Avisa cada vez que le llega un aviso nuevo al usuario. Devuelve la función para desuscribirse. */
export function suscribirseANotificaciones(usuarioId: string, alLlegar: () => void): () => void {
  const canal = supabase
    .channel(`notificaciones-${usuarioId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` },
      alLlegar,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
