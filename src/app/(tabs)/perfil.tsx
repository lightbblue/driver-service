import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { FilaEstadisticas } from '@/components/perfil/fila-estadisticas';
import { FilaMenu, type ItemMenu } from '@/components/perfil/fila-menu';
import { Avatar, Boton, Cargando, FondoMarca, LogoRider, Pantalla } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import {
  actualizarFotoPerfil,
  cerrarSesion,
  obtenerUsuarioActual,
} from '@/services';
import type { Perfil } from '@/types';

const SECCIONES: ItemMenu[] = [
  { id: 'datos', titulo: 'Mis datos', subtitulo: 'Información personal, contacto y dirección', icono: 'person-outline' },
  { id: 'motos', titulo: 'Mis motos', subtitulo: 'Gestioná tus vehículos', icono: 'bicycle-outline' },
  { id: 'historial', titulo: 'Historial de solicitudes', subtitulo: 'Revisá tus asistencias anteriores', icono: 'time-outline' },
  { id: 'favoritos', titulo: 'Favoritos', subtitulo: 'Tus mecánicos guardados', icono: 'heart-outline' },
  { id: 'pagos', titulo: 'Métodos de pago', subtitulo: 'Tarjetas y otros medios', icono: 'card-outline' },
  { id: 'notificaciones', titulo: 'Notificaciones', subtitulo: 'Configurá tus alertas', icono: 'notifications-outline' },
  { id: 'seguridad', titulo: 'Seguridad', subtitulo: 'Contraseña, verificación en dos pasos', icono: 'shield-checkmark-outline' },
  { id: 'ayuda', titulo: 'Ayuda y soporte', subtitulo: 'Preguntas frecuentes y contacto', icono: 'help-circle-outline' },
];

const ROLES: Record<string, string> = {
  cliente: 'Usuario',
  mecanico: 'Mecánico',
  admin: 'Administrador',
};

export default function PerfilScreen() {
  const router = useRouter();
  const { datos: usuario, cargando, recargar } = useRecurso<Perfil | null>(obtenerUsuarioActual, null);
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Al volver de "Editar perfil" se vuelven a leer los datos para mostrar los cambios.
  useFocusEffect(recargar);

  const localidad = [usuario?.localidad, usuario?.provincia].filter(Boolean).join(', ');

  async function cambiarFoto() {
    if (subiendoFoto) return;

    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        // En Android no se puede leer el archivo local con fetch: la imagen se pide ya codificada.
        base64: true,
      });

      if (resultado.canceled) return;

      const imagen = resultado.assets[0];

      if (!imagen?.base64) {
        Alert.alert('Error', 'No se pudo obtener la imagen seleccionada.');
        return;
      }

      setSubiendoFoto(true);
      const url = await actualizarFotoPerfil(imagen.base64, imagen.mimeType);
      setAvatarLocal(url);
      Alert.alert('Foto actualizada', 'Tu foto de perfil se guardó correctamente.');
    } catch (error) {
      Alert.alert(
        'No se pudo cambiar la foto',
        error instanceof Error ? error.message : 'Intentá nuevamente.',
      );
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <Pantalla>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="overflow-hidden">
          <FondoMarca variante="montania" velo="suave" />
          <View className="px-4 pb-5 pt-2">
            <View className="mb-6 flex-row items-center justify-between">
              <LogoRider tamanio="chico" />
              <View className="flex-row items-center gap-2">
                <Pressable
                  testID="btn-notificaciones"
                  accessibilityRole="button"
                  accessibilityLabel="Notificaciones"
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full bg-fondo/60 active:bg-superficie"
                >
                  <Ionicons name="notifications-outline" size={19} color={COLORES.texto} />
                  <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-peligro" />
                </Pressable>
                <Pressable
                  testID="btn-configuracion"
                  accessibilityRole="button"
                  accessibilityLabel="Configuración"
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full bg-fondo/60 active:bg-superficie"
                >
                  <Ionicons name="settings-outline" size={19} color={COLORES.texto} />
                </Pressable>
              </View>
            </View>

            {cargando && !usuario ? (
              <Cargando mensaje="" />
            ) : (
              <View className="flex-row items-center gap-4">
                <View>
                  <View className="rounded-full border-2 border-acento p-0.5">
                    <Avatar uri={avatarLocal ?? usuario?.avatar_url} tamanio={84} />
                  </View>
                  <Pressable
                    testID="btn-cambiar-foto"
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar foto de perfil"
                    disabled={subiendoFoto}
                    onPress={cambiarFoto}
                    className="absolute -bottom-1 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-fondo bg-superficie-alta active:bg-superficie"
                  >
                    {subiendoFoto ? (
                      <ActivityIndicator size="small" color={COLORES.texto} />
                    ) : (
                      <Ionicons name="camera" size={15} color={COLORES.texto} />
                    )}
                  </Pressable>
                </View>

                <View className="flex-1 gap-1">
                  <Text className="text-2xl font-extrabold text-texto" numberOfLines={2}>
                    {usuario?.nombre_completo ?? 'Sin nombre'}
                  </Text>
                  <Text className="text-sm text-texto-tenue">
                    {ROLES[usuario?.rol ?? 'cliente'] ?? 'Usuario'}
                  </Text>
                  {localidad ? (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="location-outline" size={14} color={COLORES.textoTenue} />
                      <Text className="text-chico text-texto-tenue">{localidad}</Text>
                    </View>
                  ) : null}
                  <Boton
                    testID="btn-editar-perfil"
                    titulo="Editar perfil"
                    variante="fantasma"
                    icono="create-outline"
                    className="mt-1 min-h-[40px] self-start px-4 py-2"
                    onPress={() => router.push('/editar-perfil')}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="gap-3 px-4 pt-4">
          <FilaEstadisticas estadisticas={usuario?.estadisticas ?? null} />

          <Boton
            testID="btn-mis-ganancias"
            titulo="Mis ganancias"
            variante="primario"
            icono="cash-outline"
            iconoDerecha="chevron-forward"
            onPress={() => router.push('/ganancias')}
          />

          <View className="gap-2.5 pt-1">
            {SECCIONES.map((seccion) => (
              <FilaMenu key={seccion.id} item={seccion} />
            ))}
          </View>

          <Boton
            testID="btn-cerrar-sesion"
            titulo="Cerrar sesión"
            variante="peligro"
            icono="log-out-outline"
            className="mt-2"
            onPress={() =>
              cerrarSesion()
                .then(() => router.replace('/login'))
                .catch((error: Error) =>
                  Alert.alert('No se pudo cerrar la sesión', error.message),
                )
            }
          />
        </View>
      </ScrollView>
    </Pantalla>
  );
}
