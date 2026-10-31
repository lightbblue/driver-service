import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { ResumenGanancias, ServicioCobrado } from '@/types';

import { obtenerMecanicoIdActual } from './sesion';

type FilaPago = {
  id: string;
  solicitud_id: string;
  monto: number;
  comision: number;
  neto_mecanico: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  creado_en: string;
  solicitud: {
    codigo: string;
    categoria: { nombre: string } | null;
  } | null;
};

/**
 * Consulta los servicios cobrados por el mecánico autenticado (RF-PAY-004, RF-VIEW-015).
 * - Restringido exclusivamente al mecánico autenticado (RF-AUTH-006, CP-GAN-05).
 * - Lista únicamente los servicios con pago aprobado / 'Pagado' (RN-007, CP-GAN-03).
 * - Calcula el "Total a liquidar" sumando los netos (90 %) de los servicios cobrados (RN-012, CP-GAN-02).
 */
export async function obtenerMisGanancias(): Promise<ResumenGanancias> {
  const mecanicoId = await obtenerMecanicoIdActual();

  // RF-AUTH-006 / CP-GAN-05: Un usuario con rol cliente no tiene acceso
  if (!mecanicoId) {
    throw new Error('Solo los mecánicos tienen acceso a la sección de ganancias (RF-AUTH-006).');
  }

  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id,
      solicitud_id,
      monto,
      comision,
      neto_mecanico,
      estado,
      creado_en,
      solicitud:solicitudes (
        codigo,
        categoria:categorias_averia ( nombre )
      )
    `)
    .eq('mecanico_id', mecanicoId)
    .eq('estado', 'aprobado')
    .order('creado_en', { ascending: false });

  if (error) {
    lanzar(error, 'No se pudieron cargar las ganancias del mecánico');
  }

  const filas = (data as unknown as FilaPago[]) ?? [];

  // CP-GAN-01: Lista con el neto (90 %) de cada servicio cobrado
  const servicios: ServicioCobrado[] = filas.map((fila) => ({
    id: fila.id,
    solicitud_id: fila.solicitud_id,
    codigo_solicitud: fila.solicitud?.codigo ?? 'RS-XXXX',
    categoria_nombre: fila.solicitud?.categoria?.nombre ?? 'Asistencia técnica',
    fecha_cobro: fila.creado_en,
    monto_total: Number(fila.monto),
    neto_mecanico: Number(fila.neto_mecanico),
    comision_plataforma: Number(fila.comision),
    estado_pago: fila.estado,
  }));

  // CP-GAN-02: Total a liquidar = suma de los netos
  const total_a_liquidar = Math.round(
    servicios.reduce((total, s) => total + s.neto_mecanico, 0) * 100,
  ) / 100;

  const total_bruto = Math.round(
    servicios.reduce((total, s) => total + s.monto_total, 0) * 100,
  ) / 100;

  const total_comisiones = Math.round(
    servicios.reduce((total, s) => total + s.comision_plataforma, 0) * 100,
  ) / 100;

  return {
    servicios,
    total_a_liquidar,
    total_bruto,
    total_comisiones,
    cantidad_servicios: servicios.length,
  };
}

/**
 * Cálculo del 90 % neto y 10 % de comisión según RN-012:
 * "La comisión es el 10 % del monto final; el neto del mecánico es el 90 %.
 * Se redondea a 2 decimales y la comisión absorbe la diferencia".
 *
 * Utilidad de formato y cálculo para la interfaz (los valores persistidos
 * provienen exclusivamente del servidor según RNF-SEC-005).
 */
export function calcularNetoYComision(monto: number): { neto: number; comision: number } {
  if (monto <= 0) return { neto: 0, comision: 0 };
  const neto = Math.round(monto * 0.9 * 100) / 100;
  const comision = Math.round((monto - neto) * 100) / 100;
  return { neto, comision };
}

