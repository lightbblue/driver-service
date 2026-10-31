import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { formatearFechaHora } from '@/lib/formato';
import { iconoDeCategoria } from '@/lib/iconos';
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

      <DistintivoEstado estado={servicio.estado} />
      {servicio.estado === 'finalizado' ? (
        <Text
          testID={`estado-pago-${servicio.estado_pago ?? 'pendiente'}`}
          className={`text-chico font-semibold ${
            servicio.estado_pago === 'pagado' ? 'text-exito' : 'text-acento'
          }`}>
          {servicio.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente de pago'}
        </Text>
      ) : null}
    </Pressable>
  );
}
