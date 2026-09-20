import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

/**
 * Control inerte de autenticación federada (sección 4.4).
 * Se renderiza pero no ejecuta ninguna acción: depende del backend (RF-AUTH-007).
 */
export function BotonGoogle({ titulo = 'Continuar con Google' }: { titulo?: string }) {
  return (
    <Pressable
      testID="btn-google"
      accessibilityRole="button"
      accessibilityLabel={titulo}
      className="min-h-[52px] flex-row items-center justify-center gap-2.5 rounded-campo border border-acento bg-transparent px-5 py-4 active:bg-acento/10">
      <Ionicons name="logo-google" size={19} color="#FFC107" />
      <Text className="text-base font-bold text-texto">{titulo}</Text>
    </Pressable>
  );
}
