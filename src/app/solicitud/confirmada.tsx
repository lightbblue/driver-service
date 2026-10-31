import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Boton, Pantalla } from '@/components/ui';
import { COLORES } from '@/lib/tema';

/** Cierre del flujo de solicitud (RF-VIEW-006, paso 4): la solicitud ya está guardada. */
export default function SolicitudConfirmadaScreen() {
  const router = useRouter();
  const { id, codigo } = useLocalSearchParams<{ id?: string; codigo?: string }>();

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-acento/15">
          <Ionicons name="checkmark-circle" size={62} color={COLORES.acento} />
        </View>

        <Text className="text-center text-2xl font-extrabold text-texto">
          Recibimos tu solicitud
        </Text>
        <Text className="text-center text-sm leading-5 text-texto-tenue">
          Estamos buscando un mecánico disponible. Vas a ver cuándo la acepta y cuándo sale en
          camino desde el seguimiento o desde Mis solicitudes.
        </Text>

        {codigo ? (
          <View className="mt-2 rounded-full border border-borde bg-superficie px-3 py-1.5">
            <Text testID="texto-codigo-solicitud" className="text-mini font-semibold text-acento">
              Solicitud #{codigo}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3 px-6 pb-6">
        {id ? (
          <Boton
            testID="btn-ver-seguimiento"
            titulo="Ver seguimiento"
            icono="navigate-outline"
            onPress={() => router.replace({ pathname: '/solicitud/[id]', params: { id } })}
          />
        ) : null}
        <Boton
          variante="secundario"
          testID="btn-volver-inicio"
          titulo="Volver al Inicio"
          icono="home-outline"
          onPress={() => router.replace('/inicio')}
        />
      </View>
    </Pantalla>
  );
}
