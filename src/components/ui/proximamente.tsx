import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { LogoRider } from './logo-rider';
import { Pantalla } from './pantalla';

type ProximamenteProps = {
  titulo: string;
  requisito: string;
  detalle: string;
};

/**
 * Pantalla de relleno para las rutas todavía no implementadas.
 * RF-VIEW-011 exige que una pestaña sin pantalla nunca provoque un error.
 */
export function Proximamente({ titulo, requisito, detalle }: ProximamenteProps) {
  return (
    <Pantalla>
      <View className="px-4 pt-2">
        <LogoRider tamanio="chico" />
      </View>

      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-superficie">
          <Ionicons name="construct-outline" size={34} color="#FFC107" />
        </View>
        <Text className="text-center text-xl font-bold text-texto">{titulo}</Text>
        <Text className="text-center text-sm text-texto-tenue">{detalle}</Text>
        <View className="mt-2 rounded-full border border-borde bg-superficie px-3 py-1.5">
          <Text className="text-mini font-semibold text-acento">{requisito}</Text>
        </View>
      </View>
    </Pantalla>
  );
}
