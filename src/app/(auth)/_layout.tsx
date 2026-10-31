import { Stack } from 'expo-router';

import { COLORES } from '@/lib/tema';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORES.fondo } }}
    />
  );
}
