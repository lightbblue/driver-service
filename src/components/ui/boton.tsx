import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

type BotonProps = {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  icono?: keyof typeof Ionicons.glyphMap;
  iconoDerecha?: keyof typeof Ionicons.glyphMap;
  cargando?: boolean;
  deshabilitado?: boolean;
  className?: string;
  testID?: string;
};

const CONTENEDOR: Record<Variante, string> = {
  primario: 'bg-acento active:bg-acento-oscuro',
  secundario: 'bg-superficie-alta border border-borde active:bg-superficie',
  fantasma: 'bg-transparent border border-acento active:bg-acento/10',
  peligro: 'bg-transparent border border-peligro active:bg-peligro/10',
};

const TEXTO: Record<Variante, string> = {
  primario: 'text-texto-inverso',
  secundario: 'text-texto',
  fantasma: 'text-acento',
  peligro: 'text-peligro',
};

const ICONO: Record<Variante, string> = {
  primario: '#0B0B0D',
  secundario: '#FFFFFF',
  fantasma: '#FFC107',
  peligro: '#EF4444',
};

/** Botón del sistema de diseño. Siempre responde visualmente al toque (RNF-UX-004). */
export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  iconoDerecha,
  cargando = false,
  deshabilitado = false,
  className,
  testID,
}: BotonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado || cargando}
      onPress={onPress}
      className={cn(
        'min-h-[52px] flex-row items-center justify-center gap-2 rounded-campo px-5 py-4',
        CONTENEDOR[variante],
        deshabilitado && 'opacity-40',
        className,
      )}>
      {cargando ? (
        <ActivityIndicator color={ICONO[variante]} />
      ) : (
        <>
          {icono ? <Ionicons name={icono} size={18} color={ICONO[variante]} /> : null}
          <Text className={cn('text-base font-bold', TEXTO[variante])}>{titulo}</Text>
          {iconoDerecha ? (
            <View className="ml-1">
              <Ionicons name={iconoDerecha} size={18} color={ICONO[variante]} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
