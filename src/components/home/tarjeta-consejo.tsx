import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { Consejo } from '@/types';

/**
 * Tarjeta del carrusel "Consejos para tu viaje".
 * No es navegable: la pantalla de detalle es COULD y queda fuera del mapa (sección 4.4).
 */
export function TarjetaConsejo({ consejo }: { consejo: Consejo }) {
  return (
    <View
      testID={`tarjeta-consejo-${consejo.id}`}
      className="w-[268px] overflow-hidden rounded-tarjeta border border-borde bg-superficie">
      <View className="h-[110px] items-center justify-center bg-superficie-alta">
        {consejo.imagen_url ? (
          <Image
            source={{ uri: consejo.imagen_url }}
            style={{ width: '100%', height: 110 }}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <Ionicons name="image-outline" size={28} color="#6B7280" />
        )}
      </View>

      <View className="gap-1 p-3">
        <Text className="text-sm font-bold text-texto" numberOfLines={2}>
          {consejo.titulo}
        </Text>
        <Text className="text-mini text-texto-tenue" numberOfLines={2}>
          {consejo.bajada}
        </Text>
      </View>
    </View>
  );
}
