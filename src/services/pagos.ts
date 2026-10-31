import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { Pago } from '@/types';

/**
 * Registra el pago simulado de una solicitud finalizada (RF-PAY-002, RN-013).
 *
 * La base calcula la comisión del 10 % y el neto del 90 % del mecánico (RN-012, RNF-SEC-005),
 * registra el cobro en la tabla `pagos` y añade el evento a la bitácora.
 */
export async function registrarPago(solicitudId: string): Promise<Pago> {
  const { data, error } = await supabase.rpc('registrar_pago', {
    p_solicitud_id: solicitudId,
  });

  if (error) lanzar(error, 'No se pudo registrar el pago');

  return data as unknown as Pago;
}

/**
 * Consulta el pago asociado a una solicitud (RF-PAY-003, RF-SEC-001).
 * Devuelve el registro de pago o null si la solicitud no fue pagada aún.
 */
export async function obtenerPago(solicitudId: string): Promise<Pago | null> {
  const { data, error } = await supabase
    .from('pagos')
    .select(
      'id, solicitud_id, cliente_id, mecanico_id, monto, comision, neto_mecanico, medio, estado, creado_en',
    )
    .eq('solicitud_id', solicitudId)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo consultar el pago');

  return data as Pago | null;
}

