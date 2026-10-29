import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Cargando } from '@/components/ui';
import { useSesion } from '@/hooks/use-sesion';

/**
 * Punto de entrada: con una sesión guardada en el dispositivo se entra directo
 * al Inicio; si no, al inicio de sesión (RF-VIEW-002).
 */
export default function Entrada() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center bg-fondo">
        <Cargando mensaje="" />
      </View>
    );
  }

  return <Redirect href={sesion ? '/inicio' : '/login'} />;
}
