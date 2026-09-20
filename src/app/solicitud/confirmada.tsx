import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Boton, Pantalla } from '@/components/ui';

/**
 * Cierre del flujo de solicitud (RF-VIEW-006, paso 4).
 *
 * No muestra identificador de solicitud a propósito: generarlo implicaría
 * registrar la solicitud, que es Entrega 2 (RF-ASSIST-005).
 */
export default function SolicitudConfirmadaScreen() {
  const router = useRouter();

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-acento/15">
          <Ionicons name="checkmark-circle" size={62} color="#FFC107" />
        </View>

        <Text className="text-center text-2xl font-extrabold text-texto">
          Recibimos tu solicitud
        </Text>
        <Text className="text-center text-sm leading-5 text-texto-tenue">
          Estamos buscando el mecánico disponible más cercano. Vas a poder seguir el estado del
          servicio desde Mis solicitudes.
        </Text>

        <View className="mt-2 rounded-full border border-borde bg-superficie px-3 py-1.5">
          <Text className="text-mini font-semibold text-acento">
            Asignación real: RF-MATCH-001 · Entrega 2
          </Text>
        </View>
      </View>

      <View className="px-6 pb-6">
        <Boton
          testID="btn-volver-inicio"
          titulo="Volver al Inicio"
          icono="home-outline"
          onPress={() => router.replace('/inicio')}
        />
      </View>
    </Pantalla>
  );
}
