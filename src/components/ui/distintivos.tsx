import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

const DISTINTIVOS = [
  { id: 'asistencia', icono: 'shield-checkmark-outline', titulo: 'ASISTENCIA\nRÁPIDA' },
  { id: 'region', icono: 'location-outline', titulo: 'EN TODA\nLA REGIÓN' },
  { id: 'comunidad', icono: 'people-outline', titulo: 'COMUNIDAD\nMOTERA' },
] as const;

/** Los tres distintivos inferiores de las pantallas de acceso. */
export function Distintivos() {
  return (
    <View className="flex-row items-start justify-center">
      {DISTINTIVOS.map((distintivo, indice) => (
        <View key={distintivo.id} className="flex-row">
          {indice > 0 ? <View className="mx-1 w-px self-stretch bg-borde" /> : null}
          <View className="w-[104px] items-center gap-1.5 px-1">
            <Ionicons name={distintivo.icono} size={22} color="#FFC107" />
            <Text className="text-center text-micro font-bold tracking-wide text-texto">
              {distintivo.titulo}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
