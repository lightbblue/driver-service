import { Text, View } from 'react-native';

/** Separador "o" entre el acceso principal y el federado. */
export function SeparadorO() {
  return (
    <View className="my-1 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-borde" />
      <Text className="text-chico text-texto-tenue">o</Text>
      <View className="h-px flex-1 bg-borde" />
    </View>
  );
}
