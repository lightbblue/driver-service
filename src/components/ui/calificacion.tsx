import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type CalificacionProps = {
  puntaje?: number | null;
  resenias?: number | null;
  tamanio?: number;
};

/** Estrella + puntaje + cantidad de reseñas. Tolera valores nulos. */
export function Calificacion({ puntaje, resenias, tamanio = 14 }: CalificacionProps) {
  if (puntaje == null) {
    return <Text className="text-chico text-texto-sutil">Sin calificaciones</Text>;
  }

  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name="star" size={tamanio} color="#FFC107" />
      <Text className="text-chico font-bold text-texto">{puntaje.toFixed(1)}</Text>
      {resenias != null ? (
        <Text className="text-chico text-texto-tenue">({resenias})</Text>
      ) : null}
    </View>
  );
}
