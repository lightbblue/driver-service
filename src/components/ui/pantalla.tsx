import { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type PantallaProps = {
  children: ReactNode;
  /** Bordes seguros a respetar (RNF-COMP-003). */
  bordes?: Edge[];
  className?: string;
};

/** Contenedor base de toda pantalla: fondo del tema + áreas seguras. */
export function Pantalla({ children, bordes = ['top'], className }: PantallaProps) {
  return (
    <View className="flex-1 bg-fondo">
      <SafeAreaView edges={bordes} className={cn('flex-1', className)}>
        {children}
      </SafeAreaView>
    </View>
  );
}
