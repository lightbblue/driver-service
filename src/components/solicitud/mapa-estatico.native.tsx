import { Text, View } from 'react-native';
import type { UbicacionServicio } from '@/types';

type MapaEstaticoProps = {
  etiqueta?: string;
  ubicacion: UbicacionServicio | null;
  onMover: (latitud: number, longitud: number) => void;
};

export function MapaEstatico({
  etiqueta = 'Tu ubicación actual',
  ubicacion,
}: MapaEstaticoProps) {
  return (
    <View className="rounded-tarjeta border border-borde bg-superficie-alta p-4">
      <Text className="mb-2 font-semibold text-texto">{etiqueta}</Text>
      <Text className="text-texto">
        {ubicacion
          ? `Latitud: ${ubicacion.latitud.toFixed(6)}\nLongitud: ${ubicacion.longitud.toFixed(6)}`
          : 'Esperando la ubicación GPS...'}
      </Text>
      <Text className="mt-2 text-texto">
        Podés corregir la dirección en el campo que aparece debajo del mapa.
      </Text>
    </View>
  );
}
