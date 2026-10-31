import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

type ChipProps = {
  texto: string;
  activo?: boolean;
  onPress?: () => void;
  className?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/** Etiqueta compacta: especialidades, filtros, estados (RF-UX-007). */
export function Chip({
  texto,
  activo = false,
  onPress,
  className,
  accessibilityLabel,
  accessibilityHint,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? texto}
      accessibilityHint={accessibilityHint}
      accessibilityState={onPress ? { selected: activo } : undefined}
      className={cn(
        'rounded-full border px-3 py-1.5',
        activo ? 'border-acento bg-acento/15' : 'border-borde bg-superficie-alta',
        onPress && 'active:opacity-70',
        className,
      )}>
      <Text className={cn('text-mini font-semibold', activo ? 'text-acento' : 'text-texto-tenue')}>
        {texto}
      </Text>
    </Pressable>
  );
}
