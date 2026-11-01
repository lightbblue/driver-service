import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { formatearFechaHora, formatearMoneda } from '@/lib/formato';
import { iconoDeCategoria } from '@/lib/iconos';
import { ETIQUETA_ESTADO_PAGO } from '@/services';
import type { Servicio } from '@/types';

import { DistintivoEstado } from './distintivo-estado';

/** Resumen de una solicitud en las listas; al tocarla abre el seguimiento. */
export function TarjetaSolicitud({ servicio, onPress }: { servicio: Servicio; onPress: () => void }) {
  return (
    <Pressable
      testID={`solicitud-${servicio.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${servicio.categoria_nombre}, ${servicio.codigo}`}
      onPress={onPress}
      className="gap-3 rounded-tarjeta border border-borde bg-superficie p-4 active:bg-superficie-alta">
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-superficie-alta">
          <Ionicons name={iconoDeCategoria(servicio.categoria_icono ?? '')} size={20} color="#FFC107" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-texto">{servicio.categoria_nombre}</Text>
          <Text className="text-mini text-texto-tenue">
            {servicio.codigo} · {formatearFechaHora(servicio.creado_en)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#6B7280" />
      </View>

      <View className="flex-row items-center gap-1.5">
        <Ionicons name="location-outline" size={14} color="#9CA3AF" />
        <Text className="flex-1 text-chico text-texto-tenue" numberOfLines={1}>
          {servicio.ubicacion.direccion}
        </Text>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <DistintivoEstado estado={servicio.estado} />
        {/* RF-PAY-003: monto y estado del cobro */}
        {servicio.monto_final != null && servicio.pago ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-bold text-texto">{formatearMoneda(servicio.monto_final)}</Text>
            <Text
              testID={`estado-pago-${servicio.id}`}
              className={cn(
                'text-mini font-bold',
                servicio.pago.estado === 'cobrado'
                  ? 'text-exito'
                  : servicio.pago.estado === 'retenido' || servicio.pago.estado === 'pendiente'
                    ? 'text-acento'
                    : 'text-texto-tenue',
              )}>
              {ETIQUETA_ESTADO_PAGO[servicio.pago.estado]}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
