import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
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

/**
 * Barra de navegación inferior con el botón SOS central (RF-VIEW-011).
 * El SOS no es una pestaña: es un acceso directo al flujo de solicitud.
 */
export function BarraInferior({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();

  const rutaActiva = state.routes[state.index]?.name;

  const irA = (nombre: string) => {
    const destino = state.routes.find((r) => r.name === nombre);
    if (!destino) return;
    navigation.navigate(destino.name as never);
  };

  const renderPestania = (pestania: Pestania) => {
    const activa = rutaActiva === pestania.nombre;

    return (
      <Pressable
        key={pestania.nombre}
        testID={`pestania-${pestania.nombre}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: activa }}
        accessibilityLabel={pestania.etiqueta}
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
          accessibilityLabel="SOS: solicitar asistencia"
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
