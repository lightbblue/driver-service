import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type BotonGoogleProps = {
  titulo?: string;
  onPress?: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
};

/**
 * Botón para inicio de sesión federado con Google (RF-AUTH-007).
 * Cumple con RNF-UX-004 (respuesta táctil y estado deshabilitado/cargando).
 */
export function BotonGoogle({
  titulo = 'Continuar con Google',
  onPress,
  cargando = false,
  deshabilitado = false,
}: BotonGoogleProps) {
  return (
    <Pressable
      testID="btn-google"
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: deshabilitado || cargando }}
      disabled={deshabilitado || cargando}
      onPress={onPress}
      className={`min-h-[52px] flex-row items-center justify-center gap-2.5 rounded-campo border border-acento bg-transparent px-5 py-4 active:bg-acento/10 ${
        deshabilitado ? 'opacity-40' : ''
      }`}>
      {cargando ? (
        <ActivityIndicator color="#FFC107" />
      ) : (
        <>
          <Ionicons name="logo-google" size={19} color="#FFC107" />
          <Text className="text-base font-bold text-texto">{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}
