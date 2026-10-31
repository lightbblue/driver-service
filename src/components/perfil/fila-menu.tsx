import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { COLORES } from '@/lib/tema';

export type ItemMenu = {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: keyof typeof Ionicons.glyphMap;
};

/**
 * Fila del menú de secciones del perfil.
 * Responde al toque pero no navega: su funcionalidad es E2 (RF-PROF-002 a 006).
 */
export function FilaMenu({ item }: { item: ItemMenu }) {
  return (
    <Pressable
      testID={`menu-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.titulo}
      className="min-h-[68px] flex-row items-center gap-3 rounded-tarjeta border border-borde bg-superficie px-4 py-3 active:bg-superficie-alta">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-superficie-alta">
        <Ionicons name={item.icono} size={19} color={COLORES.texto} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-texto">{item.titulo}</Text>
        <Text className="text-mini text-texto-tenue" numberOfLines={1}>
          {item.subtitulo}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={COLORES.textoSutil} />
    </Pressable>
  );
}
