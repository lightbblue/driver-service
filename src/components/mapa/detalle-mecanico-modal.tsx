import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Modal, Pressable, Text, TouchableWithoutFeedback, View } from 'react-native';

import { Avatar, Boton, Calificacion, Chip } from '@/components/ui';
import { formatearDistancia } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import type { Mecanico } from '@/types';

type DetalleMecanicoModalProps = {
  mecanico: Mecanico | null;
  onCerrar: () => void;
};

/**
 * Modal / Tarjeta inferior (BottomSheet) con los detalles del mecánico seleccionado en el mapa (RF-VIEW-007).
 */
export function DetalleMecanicoModal({ mecanico, onCerrar }: DetalleMecanicoModalProps) {
  const router = useRouter();

  if (!mecanico) return null;

  // Sin ubicación cargada: no tiene taller, hace asistencia en la ruta.
  const enRuta = mecanico.latitud === 0 && mecanico.longitud === 0;

  const llamar = () => {
    if (mecanico.telefono) {
      void Linking.openURL(`tel:${mecanico.telefono}`);
    }
  };

  const solicitarAuxilio = () => {
    onCerrar();
    router.push('/solicitud/nueva');
  };

  return (
    <Modal
      visible={Boolean(mecanico)}
      transparent
      animationType="slide"
      onRequestClose={onCerrar}
    >
      <TouchableWithoutFeedback onPress={onCerrar}>
        <View className="flex-1 justify-end bg-black/60">
          <TouchableWithoutFeedback>
            <View className="rounded-t-3xl border-t border-borde bg-superficie px-5 pb-8 pt-4 shadow-2xl">
              {/* Barra superior de arrastre */}
              <View className="mb-3 items-center">
                <View className="h-1.5 w-12 rounded-full bg-superficie-alta" />
              </View>

              {/* Encabezado con Avatar, Nombre y Botón de cierre */}
              <View className="flex-row items-center gap-3">
                <View className="relative">
                  <Avatar uri={mecanico.logo_url} tamanio={54} icono="construct" />
                  <View
                    className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-superficie ${
                      mecanico.disponible ? 'bg-exito' : 'bg-texto-sutil'
                    }`}
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg font-bold text-texto" numberOfLines={1}>
                      {mecanico.nombre_taller}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-3 pt-0.5">
                    <Calificacion
                      puntaje={mecanico.calificacion_promedio}
                      resenias={mecanico.cantidad_calificaciones}
                      tamanio={13}
                    />
                    <Text className="text-micro font-semibold text-acento">
                      {mecanico.disponible ? 'Disponible ahora' : 'No disponible'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={onCerrar}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar detalles del mecánico"
                  accessibilityHint="Cierra esta ventana modal"
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta active:opacity-70"
                >
                  <Ionicons name="close" size={20} color={COLORES.textoTenue} />
                </Pressable>
              </View>

              {/* Distancia y Dirección */}
              <View className="mt-4 flex-row items-center justify-between rounded-xl border border-borde bg-fondo px-3.5 py-2.5">
                <View className="flex-1 flex-row items-center gap-2">
                  <Ionicons
                    name={enRuta ? 'car-outline' : 'location'}
                    size={17}
                    color={COLORES.acento}
                  />
                  <Text className="flex-1 text-xs text-texto-tenue" numberOfLines={1}>
                    {enRuta
                      ? `Asistencia en ruta · ${mecanico.localidad}`
                      : mecanico.direccion_taller || mecanico.localidad}
                  </Text>
                </View>

                {mecanico.distancia_km != null ? (
                  <View className="ml-2 rounded-md bg-acento/10 px-2 py-0.5">
                    <Text className="text-xs font-bold text-acento">
                      {formatearDistancia(mecanico.distancia_km)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Descripción (si la tiene) */}
              {mecanico.descripcion ? (
                <Text className="mt-3 text-xs leading-relaxed text-texto-tenue" numberOfLines={4}>
                  {mecanico.descripcion}
                </Text>
              ) : null}

              {/* Especialidades */}
              {mecanico.especialidades && mecanico.especialidades.length > 0 ? (
                <View className="mt-3.5">
                  <Text className="mb-1.5 text-mini font-bold uppercase tracking-wider text-texto-tenue">
                    Especialidades
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {mecanico.especialidades.map((esp) => (
                      <Chip key={esp} texto={esp} />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Botones de acción */}
              <View className="mt-6 flex-row gap-3">
                {mecanico.telefono ? (
                  <Pressable
                    onPress={llamar}
                    accessibilityRole="button"
                    accessibilityLabel={`Llamar al taller ${mecanico.nombre_taller}`}
                    accessibilityHint={`Inicia una llamada telefónica al número ${mecanico.telefono}`}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-campo border border-borde bg-superficie-alta py-3.5 active:bg-superficie"
                  >
                    <Ionicons name="call-outline" size={19} color={COLORES.acento} />
                    <Text className="text-sm font-bold text-texto">Llamar</Text>
                  </Pressable>
                ) : null}

                <View className="flex-[1.5]">
                  <Boton
                    titulo="Solicitar asistencia"
                    icono="warning-outline"
                    accessibilityLabel="Solicitar asistencia"
                    accessibilityHint="Abre el formulario de solicitud; la toma el primer mecánico disponible"
                    onPress={solicitarAuxilio}
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

