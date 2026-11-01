import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Tarjeta } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatearMoneda } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { detalleEstadoPago, ETIQUETA_ESTADO_PAGO, estadoPago, NOMBRE_MEDIO } from '@/services';
import type { EstadoPago, Servicio } from '@/types';

type ResumenPagoProps = {
  servicio: Servicio;
  /** El mecánico asignado ve su neto (90 %) y la comisión (10 %). */
  esAsignado: boolean;
};

const ESTILO: Record<EstadoPago, { icono: keyof typeof Ionicons.glyphMap; color: string; fondo: string; texto: string }> = {
  sin_cobro: { icono: 'remove-circle-outline', color: COLORES.textoTenue, fondo: 'bg-superficie-alta', texto: 'text-texto-tenue' },
  retenido: { icono: 'lock-closed-outline', color: COLORES.acento, fondo: 'bg-acento/15', texto: 'text-acento' },
  pendiente: { icono: 'cash-outline', color: COLORES.acento, fondo: 'bg-acento/15', texto: 'text-acento' },
  cobrado: { icono: 'checkmark-circle', color: COLORES.exito, fondo: 'bg-exito/15', texto: 'text-exito' },
  devuelto: { icono: 'return-up-back-outline', color: COLORES.info, fondo: 'bg-info/15', texto: 'text-info' },
  anulado: { icono: 'close-circle-outline', color: COLORES.textoTenue, fondo: 'bg-superficie-alta', texto: 'text-texto-tenue' },
};

/**
 * Precio del servicio y estado del cobro en el seguimiento (RF-QUOTE-002, RF-PAY-003).
 * El precio se fija al pedir, así que el cliente lo ve desde el principio.
 */
export function ResumenPago({ servicio, esAsignado }: ResumenPagoProps) {
  if (servicio.monto_final == null) return null;

  const estado = estadoPago(servicio);
  const estilo = ESTILO[estado];
  const pago = servicio.pago;

  return (
    <Tarjeta testID="tarjeta-pago" className="gap-3 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="gap-0.5">
          <Text className="text-mini text-texto-tenue">Precio del servicio</Text>
          <Text testID="texto-monto-final" className="text-2xl font-extrabold text-texto">
            {formatearMoneda(servicio.monto_final)}
          </Text>
          <Text className="text-mini text-texto-tenue">{NOMBRE_MEDIO[servicio.medio_pago]}</Text>
        </View>
        <View className={cn('flex-row items-center gap-1.5 rounded-full px-3 py-1', estilo.fondo)}>
          <Ionicons name={estilo.icono} size={15} color={estilo.color} />
          <Text testID="texto-estado-pago" className={cn('text-mini font-bold', estilo.texto)}>
            {ETIQUETA_ESTADO_PAGO[estado]}
          </Text>
        </View>
      </View>

      {!esAsignado ? <Text className="text-mini text-texto-tenue">{detalleEstadoPago(estado)}</Text> : null}

      {esAsignado && pago ? (
        <View className="gap-1 rounded-campo bg-superficie-alta p-3">
          {pago.medio === 'efectivo' && pago.estado === 'pendiente' ? (
            <Text className="pb-1 text-mini text-acento">
              Cobrale {formatearMoneda(pago.monto)} en efectivo al terminar.
            </Text>
          ) : null}
          <View className="flex-row justify-between">
            <Text className="text-chico text-texto-tenue">Comisión Rider Service (10 %)</Text>
            <Text className="text-chico text-texto-tenue">− {formatearMoneda(pago.comision)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm font-bold text-texto">
              {pago.estado === 'cobrado' ? 'Tu neto (90 %)' : 'Vas a recibir (90 %)'}
            </Text>
            <Text className="text-sm font-bold text-exito">{formatearMoneda(pago.neto_mecanico)}</Text>
          </View>
        </View>
      ) : null}
    </Tarjeta>
  );
}
