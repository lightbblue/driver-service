import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { COLORES } from '@/lib/tema';

type BotonGoogleProps = {
  titulo?: string;
  onPress?: () => void;
  cargando?: boolean;
};

/** Inicio de sesión con Google (RF-AUTH-007). */
export function BotonGoogle({ titulo = 'Continuar con Google', onPress, cargando = false }: BotonGoogleProps) {
  return (
    <Pressable
      testID="btn-google"
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint="Abre la selección de cuenta de Google"
      accessibilityState={{ disabled: cargando, busy: cargando }}
      disabled={cargando}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center justify-center gap-2.5 rounded-campo border border-acento bg-transparent px-5 py-4 active:bg-acento/10">
      {cargando ? (
        <ActivityIndicator color={COLORES.acento} />
      ) : (
        <Ionicons name="logo-google" size={19} color={COLORES.acento} />
      )}
      <Text className="text-base font-bold text-texto">{titulo}</Text>
    </Pressable>
  );
}
