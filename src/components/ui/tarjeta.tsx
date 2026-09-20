import { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

type TarjetaProps = ViewProps & { children: ReactNode; className?: string };

/** Superficie elevada estándar del sistema de diseño. */
export function Tarjeta({ children, className, ...rest }: TarjetaProps) {
  return (
    <View
      className={cn('rounded-tarjeta border border-borde bg-superficie', className)}
      {...rest}>
      {children}
    </View>
  );
}
