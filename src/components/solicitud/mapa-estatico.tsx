import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

/**
 * Representación visual de la ubicación.
 *
 * El SRS acepta explícitamente una imagen con marcadores superpuestos mientras
 * la integración del mapa nativo no entre en el sprint. El acceso real al GPS
 * es Entrega 3 (RF-ASSIST-003).
 */
export function MapaEstatico({ etiqueta = 'Tu ubicación actual' }: { etiqueta?: string }) {
  return (
    <View className="h-[168px] overflow-hidden rounded-tarjeta border border-borde bg-superficie-alta">
      <Image
        source={{
          uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=900&q=80',
        }}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
        transition={250}
      />
      <View className="absolute inset-0 bg-fondo/45" />

      <View className="flex-1 items-center justify-center gap-1">
        <View className="rounded-full bg-fondo px-3 py-1.5">
          <Text className="text-mini font-semibold text-texto">{etiqueta}</Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-info/30">
          <View className="h-4 w-4 rounded-full border-2 border-texto bg-info" />
        </View>
      </View>

      <View className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-fondo/80">
        <Ionicons name="locate" size={18} color="#FFC107" />
      </View>
    </View>
  );
}
