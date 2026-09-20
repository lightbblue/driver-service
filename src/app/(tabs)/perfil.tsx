import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FilaEstadisticas } from '@/components/perfil/fila-estadisticas';
import { FilaMenu, type ItemMenu } from '@/components/perfil/fila-menu';
import { Avatar, Boton, Cargando, FondoMarca, LogoRider, Pantalla } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { obtenerUsuarioActual } from '@/services';
import type { Perfil } from '@/types';

/** Secciones de la maqueta. Ninguna navega en la Entrega 1 (sección 4.4). */
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

/**
 * Pantalla de Perfil (RF-VIEW-005).
 * Muestra el usuario de ejemplo de `usuarios.json`; no hay sesión que consultar.
 */
export default function PerfilScreen() {
  const router = useRouter();
  const { datos: usuario, cargando } = useRecurso<Perfil | null>(obtenerUsuarioActual, null);

  const localidad = [usuario?.localidad, usuario?.provincia].filter(Boolean).join(', ');

  return (
    <Pantalla>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        {/* Encabezado con imagen de fondo */}
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
                  className="h-10 w-10 items-center justify-center rounded-full bg-fondo/60 active:bg-superficie">
                  <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
                  <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-peligro" />
                </Pressable>
                <Pressable
                  testID="btn-configuracion"
                  accessibilityRole="button"
                  accessibilityLabel="Configuración"
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full bg-fondo/60 active:bg-superficie">
                  <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {cargando ? (
              <Cargando mensaje="" />
            ) : (
              <View className="flex-row items-center gap-4">
                <View>
                  <View className="rounded-full border-2 border-acento p-0.5">
                    <Avatar uri={usuario?.avatar_url} tamanio={84} />
                  </View>
                  {/* Cambio de foto: control inerte (RF-PROF-002, E2) */}
                  <Pressable
                    testID="btn-cambiar-foto"
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar foto de perfil"
                    className="absolute -bottom-1 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-fondo bg-superficie-alta active:bg-superficie">
                    <Ionicons name="camera" size={15} color="#FFFFFF" />
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
                      <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                      <Text className="text-chico text-texto-tenue">{localidad}</Text>
                    </View>
                  ) : null}
                  <Boton
                    testID="btn-editar-perfil"
                    titulo="Editar perfil"
                    variante="fantasma"
                    icono="create-outline"
                    className="mt-1 min-h-[40px] self-start px-4 py-2"
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="gap-3 px-4 pt-4">
          <FilaEstadisticas estadisticas={usuario?.estadisticas ?? null} />

          <View className="gap-2.5 pt-1">
            {SECCIONES.map((seccion) => (
              <FilaMenu key={seccion.id} item={seccion} />
            ))}
          </View>

          {/* Navega al login sin limpiar estado: no hay sesión que cerrar (RF-AUTH-005, E2) */}
          <Boton
            testID="btn-cerrar-sesion"
            titulo="Cerrar sesión"
            variante="peligro"
            icono="log-out-outline"
            className="mt-2"
            onPress={() => router.replace('/login')}
          />
        </View>
      </ScrollView>
    </Pantalla>
  );
}
