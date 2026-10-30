import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Cargando } from '@/components/ui';
import { useSesion } from '@/hooks/use-sesion';

/** Muestra su contenido solo con una sesión iniciada; si no, vuelve al login. */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center bg-fondo">
        <Cargando mensaje="" />
      </View>
    );
  }

  if (!sesion) return <Redirect href="/login" />;

  return <>{children}</>;
}
