import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { EstadoPago, Pago } from '@/types';

const COLUMNAS_PAGO =
  'id, solicitud_id, cliente_id, mecanico_id, monto, comision, neto_mecanico, medio, estado, creado_en';

export async function obtenerPago(solicitudId: string): Promise<Pago | null> {
  const { data, error } = await supabase
    .from('pagos')
    .select(COLUMNAS_PAGO)
    .eq('solicitud_id', solicitudId)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo consultar el pago');
  return data as Pago | null;
}

export async function obtenerPagosPorSolicitud(
  solicitudIds: string[],
): Promise<Map<string, Pago>> {
  if (solicitudIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('pagos')
    .select(COLUMNAS_PAGO)
    .in('solicitud_id', solicitudIds);

  if (error) lanzar(error, 'No se pudieron consultar los estados de pago');
  return new Map(
    ((data ?? []) as Pago[]).map((pago) => [pago.solicitud_id, pago]),
  );
}

export async function obtenerEstadoPago(solicitudId: string): Promise<EstadoPago> {
  const pago = await obtenerPago(solicitudId);
  return pago?.estado === 'aprobado' ? 'pagado' : 'pendiente';
}

export async function registrarPagoSimulado(solicitudId: string): Promise<Pago> {
  const yaPagado = await obtenerPago(solicitudId);
  if (yaPagado?.estado === 'aprobado') {
    throw new Error('Esta solicitud ya fue pagada anteriormente.');
  }

  const { data, error } = await supabase.rpc('registrar_pago', {
    p_solicitud_id: solicitudId,
  });

  if (error) lanzar(error, 'No se pudo procesar el pago');
  if (!data) throw new Error('El servidor no devolvió el registro del pago.');

  return data as Pago;
}
