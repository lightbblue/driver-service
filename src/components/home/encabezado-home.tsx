import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Avatar, LogoRider } from '@/components/ui';
import type { Perfil } from '@/types';

type EncabezadoHomeProps = {
  usuario: Perfil | null;
  onPressPerfil: () => void;
};

const ROLES: Record<string, string> = {
  cliente: 'Usuario',
  mecanico: 'Mecánico',
  admin: 'Administrador',
};

/** Encabezado del Home: marca, campana con indicador y acceso al perfil. */
export function EncabezadoHome({ usuario, onPressPerfil }: EncabezadoHomeProps) {
  const nombrePila = usuario?.nombre_completo?.split(' ')[0] ?? 'Rider';

  return (
    <View className="mb-4 flex-row items-center justify-between">
      <LogoRider tamanio="chico" />

      <View className="flex-row items-center gap-2">
        <Pressable
          testID="btn-notificaciones"
          accessibilityRole="button"
          accessibilityLabel="Notificaciones"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-superficie active:bg-superficie-alta">
          <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
          <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-peligro" />
        </Pressable>

        <Pressable
          testID="btn-perfil-encabezado"
          accessibilityRole="button"
          accessibilityLabel="Ir al perfil"
          onPress={onPressPerfil}
          className="max-w-[160px] flex-row items-center gap-2 rounded-full bg-superficie py-1.5 pl-1.5 pr-3 active:bg-superficie-alta">
          <Avatar uri={usuario?.avatar_url} tamanio={30} />
          <View className="shrink">
            <Text className="text-mini font-bold text-texto" numberOfLines={1}>
              Hola, {nombrePila}
            </Text>
            <Text className="text-micro text-texto-tenue">
              {ROLES[usuario?.rol ?? 'cliente'] ?? 'Usuario'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={13} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}
