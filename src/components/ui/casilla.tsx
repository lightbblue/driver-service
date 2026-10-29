
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';

type CasillaProps = {
  children: ReactNode;
  testID?: string;
  accessibilityLabel: string;
  checked?: boolean;
  onChange?: (marcada: boolean) => void;
};

export function Casilla({
  children,
  testID,
  accessibilityLabel,
  checked = false,
  onChange,
}: CasillaProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange?.(!checked)}
      className="min-h-[44px] flex-row items-start gap-3 py-2 active:opacity-70">
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded border-2',
          checked ? 'border-acento bg-acento' : 'border-texto-tenue bg-transparent',
        )}>
        {checked ? (
          <Ionicons name="checkmark" size={13} color={COLORES.textoInverso} />
        ) : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
