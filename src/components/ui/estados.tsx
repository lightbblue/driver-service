import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';

import { COLORES } from '@/lib/tema';

/** Estado de carga estándar (RNF-UX-003): ninguna pantalla queda en blanco. */
export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-12" testID="estado-cargando">
      <ActivityIndicator color={COLORES.acento} />
      <Text className="text-chico text-texto-tenue">{mensaje}</Text>
    </View>
  );
}

type ListaVaciaProps = {
  titulo: string;
  detalle?: string;
  icono?: keyof typeof Ionicons.glyphMap;
};

/** Estado de lista vacía estándar (RNF-UX-003). */
export function ListaVacia({ titulo, detalle, icono = 'file-tray-outline' }: ListaVaciaProps) {
  return (
    <View className="items-center justify-center gap-2 px-6 py-12" testID="estado-vacio">
      <Ionicons name={icono} size={34} color={COLORES.textoSutil} />
      <Text className="text-center text-base font-semibold text-texto">{titulo}</Text>
      {detalle ? (
        <Text className="text-center text-chico text-texto-tenue">{detalle}</Text>
      ) : null}
    </View>
  );
}
