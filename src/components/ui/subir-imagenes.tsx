import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

/**
 * Control de subida de imágenes del taller.
 * Se renderiza sin funcionalidad de carga: Storage es Entrega 3 (RF-FILE-001).
 */
export function SubirImagenes({ etiqueta = 'Subir imágenes (opcional)' }: { etiqueta?: string }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-texto">{etiqueta}</Text>
      <Pressable
        testID="btn-subir-imagenes"
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        className="min-h-[52px] flex-row items-center rounded-campo border border-borde bg-superficie px-4 active:bg-superficie-alta">
        <Ionicons name="image-outline" size={18} color="#6B7280" />
        <Text className="ml-3 flex-1 text-base text-texto-sutil">
          Fotos de tu taller, herramientas, etc.
        </Text>
        <Ionicons name="add-circle" size={24} color="#FFC107" />
      </Pressable>
    </View>
  );
}
