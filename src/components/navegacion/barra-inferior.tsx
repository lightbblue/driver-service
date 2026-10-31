import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type Pestania = {
  nombre: string;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
  iconoActivo: keyof typeof Ionicons.glyphMap;
};

/** Orden de la maqueta: Inicio · Mapa · [SOS] · Solicitudes · Perfil. */
const PESTANIAS: Pestania[] = [
  { nombre: 'inicio', etiqueta: 'Inicio', icono: 'home-outline', iconoActivo: 'home' },
  { nombre: 'mapa', etiqueta: 'Mapa', icono: 'map-outline', iconoActivo: 'map' },
  { nombre: 'solicitudes', etiqueta: 'Solicitudes', icono: 'chatbox-outline', iconoActivo: 'chatbox' },
  { nombre: 'perfil', etiqueta: 'Perfil', icono: 'person-outline', iconoActivo: 'person' },
];

/** Mapeo de rutas Expo Router para cada pestaña. */
const RUTAS_PESTANIA: Record<string, string> = {
  inicio: '/(tabs)/inicio',
  mapa: '/(tabs)/mapa',
  solicitudes: '/(tabs)/solicitudes',
  perfil: '/(tabs)/perfil',
};

export type BarraInferiorProps = {
  state?: {
    index: number;
    routes: Array<{ name: string; key?: string }>;
  };
  navigation?: any;
  descriptors?: any;
};

/**
 * Barra de navegación inferior con el botón SOS central (RF-VIEW-011).
 * Usa exclusivamente router.navigate() de Expo Router para cambiar de pestaña,
 * evitando el error "NAVIGATE not handled by any navigator" que ocurre cuando
 * se usa el objeto navigation de React Navigation con rutas de tabs.
 */
export function BarraInferior({ state }: BarraInferiorProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();

  // Resolver la pestaña activa de forma segura
  let rutaActiva = state?.routes && state.index != null ? state.routes[state.index]?.name : undefined;

  if (!rutaActiva && pathname) {
    if (pathname.includes('/mapa')) {
      rutaActiva = 'mapa';
    } else if (pathname.includes('/solicitudes')) {
      rutaActiva = 'solicitudes';
    } else if (pathname.includes('/perfil')) {
      rutaActiva = 'perfil';
    } else {
      rutaActiva = 'inicio';
    }
  }

  /**
   * Navegar a una pestaña usando Expo Router (estrategia canónica).
   * router.navigate con la ruta completa `/(tabs)/xxx` garantiza que el
   * tab navigator maneje la acción correctamente.
   */
  const irA = (nombre: string) => {
    const rutaDestino = RUTAS_PESTANIA[nombre] ?? `/(tabs)/${nombre}`;
    router.navigate(rutaDestino as any);
  };

  const renderPestania = (pestania: Pestania) => {
    const activa = rutaActiva === pestania.nombre;

    return (
      <Pressable
        key={pestania.nombre}
        testID={`pestania-${pestania.nombre}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: activa }}
        accessibilityLabel={`Pestaña ${pestania.etiqueta}`}
        accessibilityHint={`Navega a la pantalla de ${pestania.etiqueta}`}
        onPress={() => irA(pestania.nombre)}
        className="min-h-[44px] flex-1 items-center justify-center gap-1 py-2 active:opacity-60">
        <Ionicons
          name={activa ? pestania.iconoActivo : pestania.icono}
          size={22}
          color={activa ? '#FFC107' : '#9CA3AF'}
        />
        <Text
          className={cn(
            'text-micro font-semibold',
            activa ? 'text-acento' : 'text-texto-tenue',
          )}>
          {pestania.etiqueta}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      className="flex-row items-end border-t border-borde bg-fondo px-2 pt-2"
      style={{ paddingBottom: Math.max(bottom, 8) }}>
      {PESTANIAS.slice(0, 2).map(renderPestania)}

      <View className="w-[76px] items-center">
        <Pressable
          testID="btn-sos"
          accessibilityRole="button"
          accessibilityLabel="SOS: solicitar asistencia mecánica de emergencia"
          accessibilityHint="Abre el formulario para solicitar asistencia técnica inmediata"
          onPress={() => router.push('/solicitud/nueva')}
          className="-mt-8 h-16 w-16 items-center justify-center rounded-full border-4 border-fondo bg-acento active:bg-acento-oscuro">
          <Ionicons name="warning" size={26} color="#0B0B0D" />
          <Text className="text-micro font-black text-texto-inverso">SOS</Text>
        </Pressable>
      </View>

      {PESTANIAS.slice(2).map(renderPestania)}
    </View>
  );
}
