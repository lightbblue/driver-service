import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

export type AccesoRapido = {
  id: string;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
  /** Sin `onPress` el acceso se renderiza pero no navega (RF-VIEW-004). */
  onPress?: () => void;
};

/** Fila de accesos rápidos del Home: se reparten el ancho en partes iguales. */
export function AccesosRapidos({ accesos }: { accesos: AccesoRapido[] }) {
  return (
    <View className="mb-6 flex-row gap-2">
      {accesos.map((acceso) => {
        const navegable = Boolean(acceso.onPress);

        const etiquetaLimpia = acceso.etiqueta.replace(/\n/g, ' ');

        return (
          <Pressable
            key={acceso.id}
            testID={`acceso-${acceso.id}`}
            accessibilityRole="button"
            accessibilityLabel={etiquetaLimpia}
            accessibilityHint={navegable ? `Navega a la sección de ${etiquetaLimpia}` : undefined}
            onPress={acceso.onPress}
            className={cn(
              'min-h-[96px] flex-1 items-center justify-center gap-2 rounded-tarjeta border border-borde bg-superficie px-1.5 py-3',
              navegable ? 'active:bg-superficie-alta' : 'active:opacity-70',
            )}>
            <Ionicons name={acceso.icono} size={22} color="#FFC107" />
            <Text className="text-center text-micro font-semibold leading-[13px] text-texto">
              {acceso.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
