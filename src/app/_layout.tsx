import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

SplashScreen.preventAutoHideAsync();

/**
 * Raíz de la navegación (RF-VIEW-011).
 *
 * `(auth)` y `(tabs)` son grupos sin segmento de URL; `solicitud/` se apila
 * por encima de las pestañas para que el flujo ocupe la pantalla completa.
 */
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <ThemeProvider value={DarkTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0D' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="solicitud" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
