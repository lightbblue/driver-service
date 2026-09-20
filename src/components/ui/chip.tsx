import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

type ChipProps = {
  texto: string;
  activo?: boolean;
  onPress?: () => void;
  className?: string;
};

/** Etiqueta compacta: especialidades, filtros, estados. */
export function Chip({ texto, activo = false, onPress, className }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
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
