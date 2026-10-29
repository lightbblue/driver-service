import { Stack } from 'expo-router';

import { RequiereSesion } from '@/components/navegacion/requiere-sesion';

export default function SolicitudLayout() {
  return (
    <RequiereSesion>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0D' } }} />
    </RequiereSesion>
  );
}
