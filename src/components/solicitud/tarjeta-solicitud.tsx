import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { formatearFechaHora } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import type { Servicio } from '@/types';

import { EstadoSolicitud } from './estado-solicitud';

type TarjetaSolicitudProps = {
  solicitud: Servicio;
  onPress: () => void;
};

/** Resumen de una solicitud en el listado de Mis solicitudes. */
export function TarjetaSolicitud({ solicitud, onPress }: TarjetaSolicitudProps) {
  return (
    <Pressable
      testID={`tarjeta-solicitud-${solicitud.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Solicitud de ${solicitud.categoria_nombre}`}
      onPress={onPress}
      className="gap-3 rounded-tarjeta border border-borde bg-superficie p-4 active:bg-superficie-alta">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-bold text-texto" numberOfLines={1}>
            {solicitud.categoria_nombre}
          </Text>
          <Text className="text-mini text-texto-tenue">{formatearFechaHora(solicitud.creado_en)}</Text>
        </View>
        <EstadoSolicitud estado={solicitud.estado} />
      </View>

      <View className="flex-row items-center gap-1.5">
        <Ionicons name="location-outline" size={14} color={COLORES.textoTenue} />
        <Text className="flex-1 text-chico text-texto-tenue" numberOfLines={1}>
          {solicitud.ubicacion.direccion}
        </Text>
      </View>

      {solicitud.descripcion ? (
        <Text className="text-chico text-texto" numberOfLines={2}>
          {solicitud.descripcion}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between border-t border-borde pt-3">
        <Text className="text-mini font-semibold text-texto-sutil">#{solicitud.codigo}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-mini font-semibold text-acento">Ver detalle</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORES.acento} />
        </View>
      </View>
    </Pressable>
  );
}
