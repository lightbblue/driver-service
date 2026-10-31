import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Chip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatearDistancia } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import type { Mecanico } from '@/types';

type FilaMecanicoProps = {
  mecanico: Mecanico;
  /** Falso para quien no tiene taller: hace asistencia en la ruta en su zona (`localidad`). */
  tieneTaller: boolean;
  onPress: () => void;
};

/** Fila de la vista Lista de la pantalla Mapa (RF-VIEW-007). */
export function FilaMecanico({ mecanico, tieneTaller, onPress }: FilaMecanicoProps) {
  return (
    <Pressable
      testID={`fila-mecanico-${mecanico.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${mecanico.nombre_taller}, ${tieneTaller ? mecanico.localidad : 'asistencia en ruta'}`}
      accessibilityHint="Abre la ficha del mecánico"
      onPress={onPress}
      className="gap-2 rounded-tarjeta border border-borde bg-superficie p-3 active:opacity-80">
      <View className="flex-row items-center gap-3">
        <View>
          <Avatar uri={mecanico.logo_url} tamanio={44} icono="construct" />
          <View
            className={cn(
              'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-superficie',
              mecanico.disponible ? 'bg-exito' : 'bg-texto-sutil',
            )}
          />
        </View>

        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-texto" numberOfLines={1}>
            {mecanico.nombre_taller}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons
              name={tieneTaller ? 'location-outline' : 'car-outline'}
              size={12}
              color={COLORES.textoTenue}
            />
            <Text className="flex-1 text-mini text-texto-tenue" numberOfLines={1}>
              {tieneTaller ? mecanico.localidad : `Asistencia en ruta · ${mecanico.localidad}`}
            </Text>
          </View>
        </View>

        {mecanico.distancia_km != null ? (
          <View className="rounded-md bg-acento/10 px-2 py-0.5">
            <Text className="text-xs font-bold text-acento">
              {formatearDistancia(mecanico.distancia_km)}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={COLORES.textoSutil} />
      </View>

      {mecanico.especialidades.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {mecanico.especialidades.slice(0, 3).map((especialidad) => (
            <Chip key={especialidad} texto={especialidad} />
          ))}
          {mecanico.especialidades.length > 3 ? (
            <Chip texto={`+${mecanico.especialidades.length - 3}`} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
