import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';

import { Boton } from './boton';

/** Estado de carga estándar (RNF-UX-003): ninguna pantalla queda en blanco. */
export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <View className="items-center justify-center gap-3 py-12" testID="estado-cargando">
      <ActivityIndicator color="#FFC107" size="small" />
      <Text className="text-chico text-texto-tenue">{mensaje}</Text>
    </View>
  );
}

type ListaVaciaProps = {
  titulo: string;
  detalle?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  accion?: {
    texto: string;
    onPress: () => void;
    icono?: keyof typeof Ionicons.glyphMap;
  };
};

/** Estado de lista vacía estándar (RNF-UX-003). */
export function ListaVacia({ titulo, detalle, icono = 'file-tray-outline', accion }: ListaVaciaProps) {
  return (
    <View className="items-center justify-center gap-2 px-6 py-12" testID="estado-vacio">
      <Ionicons name={icono} size={34} color="#6B7280" />
      <Text className="text-center text-base font-semibold text-texto">{titulo}</Text>
      {detalle ? (
        <Text className="text-center text-chico text-texto-tenue">{detalle}</Text>
      ) : null}
      {accion ? (
        <View className="mt-2">
          <Boton
            titulo={accion.texto}
            variante="secundario"
            icono={accion.icono}
            onPress={accion.onPress}
            className="min-h-[42px] px-5 py-2.5"
          />
        </View>
      ) : null}
    </View>
  );
}

type EstadoErrorProps = {
  titulo?: string;
  mensaje?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  onReintentar?: () => void;
  textoReintentar?: string;
};

/** Estado de error estándar (RNF-UX-003): interfaz clara con acción de reintento. */
export function EstadoError({
  titulo = 'Ocurrió un error',
  mensaje = 'No se pudo cargar la información. Verificá tu conexión e intentá nuevamente.',
  icono = 'alert-circle-outline',
  onReintentar,
  textoReintentar = 'Reintentar',
}: EstadoErrorProps) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-12" testID="estado-error">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-peligro/15">
        <Ionicons name={icono} size={30} color="#EF4444" />
      </View>
      <Text className="text-center text-base font-bold text-texto">{titulo}</Text>
      {mensaje ? (
        <Text className="text-center text-chico text-texto-tenue">{mensaje}</Text>
      ) : null}
      {onReintentar ? (
        <View className="mt-2">
          <Boton
            titulo={textoReintentar}
            variante="secundario"
            icono="refresh-outline"
            onPress={onReintentar}
            className="min-h-[42px] px-5 py-2.5"
          />
        </View>
      ) : null}
    </View>
  );
}
