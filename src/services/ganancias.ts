import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { MedioPago } from '@/types';

import { obtenerMecanicoIdActual } from './sesion';

/** Un servicio cobrado del mecánico (RF-PAY-004). */
export interface GananciaServicio {
  id: string;
  solicitudId: string;
  codigo: string;
  problema: string;
  monto: number;
  comision: number;
  neto: number;
  medio: MedioPago;
  fecha: string;
}

export interface ResumenGanancias {
  /** Neto (90 %) de los servicios cobrados: lo que la plataforma le tiene que liquidar. */
  totalALiquidar: number;
  comisiones: number;
  servicios: GananciaServicio[];
}

type FilaPago = {
  id: string;
  solicitud_id: string;
  monto: number | string;
  comision: number | string;
  neto_mecanico: number | string;
  medio: MedioPago;
  actualizado_en: string;
  solicitud: { codigo: string; categoria: { nombre: string } | null } | null;
};

/** Mis ganancias: servicios cobrados del mecánico autenticado. RLS solo deja ver los propios. */
export async function obtenerGanancias(): Promise<ResumenGanancias> {
  const mecanicoId = await obtenerMecanicoIdActual();
  if (!mecanicoId) return { totalALiquidar: 0, comisiones: 0, servicios: [] };

  const { data, error } = await supabase
    .from('pagos')
    .select(
      'id, solicitud_id, monto, comision, neto_mecanico, medio, actualizado_en, solicitud:solicitudes ( codigo, categoria:categorias_averia ( nombre ) )',
    )
    .eq('mecanico_id', mecanicoId)
    .eq('estado', 'cobrado')
    .order('actualizado_en', { ascending: false });

  if (error) lanzar(error, 'No se pudieron cargar tus ganancias');

  const servicios = ((data ?? []) as unknown as FilaPago[]).map((fila) => ({
    id: fila.id,
    solicitudId: fila.solicitud_id,
    codigo: fila.solicitud?.codigo ?? '—',
    problema: fila.solicitud?.categoria?.nombre ?? 'Asistencia mecánica',
    monto: Number(fila.monto),
    comision: Number(fila.comision),
    neto: Number(fila.neto_mecanico),
    medio: fila.medio,
    fecha: fila.actualizado_en,
  }));

  const sumar = (campo: 'neto' | 'comision') =>
    Math.round(servicios.reduce((total, s) => total + s[campo], 0) * 100) / 100;

  return { totalALiquidar: sumar('neto'), comisiones: sumar('comision'), servicios };
}
