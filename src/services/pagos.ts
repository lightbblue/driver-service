import type { EstadoPago, MedioPago } from '@/types';

/** Porcentaje que se queda la plataforma (RN-012). Solo para mostrar: el cálculo real lo hace la base. */
export const COMISION_PLATAFORMA = 0.1;

/** Neto del mecánico tal como lo calcula la base: 90 % redondeado a 2 decimales. */
export function netoMecanico(monto: number): number {
  return Math.round(monto * (1 - COMISION_PLATAFORMA) * 100) / 100;
}

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  mercado_pago: 'Mercado Pago (simulado)',
  efectivo: 'Efectivo',
};

/** Texto corto del estado del cobro para distintivos y listas (RF-PAY-003). */
export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  sin_cobro: 'Sin cobro registrado',
  retenido: 'Pago retenido',
  pendiente: 'Efectivo al finalizar',
  cobrado: 'Pagado',
  devuelto: 'Devuelto',
  anulado: 'Sin cargo',
};

/** Explicación del estado del cobro para el cliente. */
export function detalleEstadoPago(estado: EstadoPago): string {
  switch (estado) {
    case 'retenido':
      return 'El monto quedó retenido en Mercado Pago. Se cobra cuando el mecánico finalice; si se cancela, se devuelve.';
    case 'pendiente':
      return 'Pagás en efectivo al mecánico cuando termine el trabajo.';
    case 'cobrado':
      return 'El servicio está pagado.';
    case 'devuelto':
      return 'La solicitud se canceló y se devolvió el monto retenido.';
    case 'anulado':
      return 'La solicitud se canceló: no hay nada para pagar.';
    default:
      return 'Esta solicitud es anterior al cobro por adelantado.';
  }
}
