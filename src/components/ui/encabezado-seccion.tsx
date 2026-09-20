import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type EncabezadoSeccionProps = {
  titulo: string;
  accion?: string;
  onPressAccion?: () => void;
};

/** Título de sección con acción opcional a la derecha ("Ver todos"). */
export function EncabezadoSeccion({ titulo, accion, onPressAccion }: EncabezadoSeccionProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-texto">{titulo}</Text>
      {accion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accion}
          onPress={onPressAccion}
          hitSlop={8}
          className="flex-row items-center gap-1 active:opacity-60">
          <Text className="text-chico font-semibold text-acento">{accion}</Text>
          <Ionicons name="chevron-forward" size={13} color="#FFC107" />
        </Pressable>
      ) : null}
    </View>
  );
}
