import { Stack } from 'expo-router';

import { RequiereSesion } from '@/components/navegacion/requiere-sesion';
import { COLORES } from '@/lib/tema';

export default function SolicitudLayout() {
  return (
    <RequiereSesion>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORES.fondo } }} />
    </RequiereSesion>
  );
}
