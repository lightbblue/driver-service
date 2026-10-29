import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { descriptorEstado } from '@/lib/iconos';
import type { EstadoServicio } from '@/types';

/** Estado actual de una solicitud como etiqueta compacta. */
export function DistintivoEstado({ estado }: { estado: EstadoServicio }) {
  const d = descriptorEstado(estado);

  return (
    <View
      testID={`estado-${estado}`}
      className="flex-row items-center gap-1.5 self-start rounded-full border border-borde bg-superficie-alta px-2.5 py-1">
      <Ionicons name={d.icono} size={13} color={d.colorIcono} />
      <Text className={cn('text-mini font-bold', d.color)}>{d.etiqueta}</Text>
    </View>
  );
}
