import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

type CasillaProps = {
  children: ReactNode;
  testID?: string;
  accessibilityLabel: string;
};

/**
 * Casilla de verificación. Alterna su estado visual, nada más:
 * bloquear el botón sin aceptar los términos es Entrega 2 (RF-AUTH-003).
 */
export function Casilla({ children, testID, accessibilityLabel }: CasillaProps) {
  const [marcada, setMarcada] = useState(false);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => setMarcada((m) => !m)}
      className="min-h-[44px] flex-row items-start gap-3 py-2 active:opacity-70">
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded border-2',
          marcada ? 'border-acento bg-acento' : 'border-borde bg-transparent',
        )}>
        {marcada ? <Ionicons name="checkmark" size={13} color="#0B0B0D" /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
