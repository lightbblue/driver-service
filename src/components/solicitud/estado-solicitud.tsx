import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { descriptorEstado } from '@/lib/iconos';
import { COLORES } from '@/lib/tema';
import type { EstadoServicio } from '@/types';

type EstadoSolicitudProps = {
  estado: EstadoServicio;
  grande?: boolean;
};

/** Etiqueta con ícono y color según el estado del servicio. */
export function EstadoSolicitud({ estado, grande = false }: EstadoSolicitudProps) {
  const descriptor = descriptorEstado(estado);

  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border border-borde bg-superficie-alta',
        grande ? 'px-3 py-2' : 'px-2.5 py-1',
      )}>
      <Ionicons name={descriptor.icono} size={grande ? 16 : 13} color={COLORES[descriptor.tono]} />
      <Text className={cn('font-semibold', grande ? 'text-sm' : 'text-mini', descriptor.color)}>
        {descriptor.etiqueta}
      </Text>
    </View>
  );
}
