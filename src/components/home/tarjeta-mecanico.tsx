import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Calificacion, Chip } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Mecanico } from '@/types';

type TarjetaMecanicoProps = {
  mecanico: Mecanico;
  onPress?: () => void;
  className?: string;
};

/** Tarjeta de mecánico del carrusel de destacados (RF-VIEW-004). */
export function TarjetaMecanico({ mecanico, onPress, className }: TarjetaMecanicoProps) {
  return (
    <Pressable
      testID={`tarjeta-mecanico-${mecanico.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Mecánico ${mecanico.nombre_taller}`}
      onPress={onPress}
      className={cn(
        'w-[248px] gap-2 rounded-tarjeta border border-borde bg-superficie p-3 active:opacity-80',
        className,
      )}>
      <View className="flex-row items-center gap-2.5">
        <View>
          <Avatar uri={mecanico.logo_url} tamanio={44} icono="construct" />
          <View
            className={cn(
              'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-superficie',
              mecanico.disponible ? 'bg-exito' : 'bg-texto-sutil',
            )}
          />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-bold text-texto" numberOfLines={1}>
            {mecanico.nombre_taller}
          </Text>
          <Calificacion
            puntaje={mecanico.calificacion_promedio}
            resenias={mecanico.cantidad_calificaciones}
            tamanio={12}
          />
        </View>
      </View>

      <View className="flex-row items-center gap-1">
        <Ionicons name="location-outline" size={12} color="#9CA3AF" />
        <Text className="flex-1 text-mini text-texto-tenue" numberOfLines={1}>
          {mecanico.localidad}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {mecanico.especialidades.slice(0, 2).map((especialidad) => (
          <Chip key={especialidad} texto={especialidad} />
        ))}
        {mecanico.especialidades.length > 2 ? (
          <Chip texto={`+${mecanico.especialidades.length - 2}`} />
        ) : null}
      </View>
    </Pressable>
  );
}
