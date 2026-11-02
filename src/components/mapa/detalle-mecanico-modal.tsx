import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Modal, Pressable, ScrollView, Text, TouchableWithoutFeedback, View } from 'react-native';

import { ResenasTaller } from '@/components/taller/resenas-taller';
import { SliderFotosTaller } from '@/components/taller/slider-fotos-taller';
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

  // Sin taller: hace asistencia en la ruta.
  const enRuta = mecanico.tipo === 'mecanico';

  const llamar = () => {
    if (mecanico.telefono) {
      void Linking.openURL(`tel:${mecanico.telefono}`);
    }
  };

  // La solicitud va dirigida: solo la ven y la aceptan los mecánicos de este taller (o este mecánico).
  const solicitarAuxilio = () => {
    onCerrar();
    router.push({
      pathname: '/solicitud/nueva',
      params: { destinoTipo: mecanico.tipo, destinoId: mecanico.id, destinoNombre: mecanico.nombre_taller },
    });
  };

  return (
    <Modal
      visible={Boolean(mecanico)}
      transparent
      animationType="slide"
      // En Android el velo también cubre la barra de estado.
      statusBarTranslucent
      onRequestClose={onCerrar}
    >
      <TouchableWithoutFeedback onPress={onCerrar}>
        {/* Velo suave: oscurece sin tapar el mapa de fondo */}
        <View className="flex-1 justify-end bg-black/35">
          <TouchableWithoutFeedback>
            <View className="rounded-t-3xl border-t border-borde bg-superficie px-5 pb-8 pt-4 shadow-2xl">
              {/* Barra superior de arrastre */}
              <View className="mb-3 items-center">
                <View className="h-1.5 w-12 rounded-full bg-superficie-alta" />
              </View>

              {/* Encabezado con Avatar, Nombre y Botón de cierre */}
              <View className="flex-row items-center gap-3">
                <View className="relative">
                  <Avatar
                    uri={mecanico.logo_url}
                    tamanio={54}
                    icono={mecanico.tipo === 'taller' ? 'storefront' : 'construct'}
                  />
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
                      {!mecanico.adherido
                        ? 'Solo por teléfono'
                        : mecanico.disponible
                          ? 'Disponible ahora'
                          : 'No disponible'}
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

              {/* Con scroll: fotos y reseñas pueden ser largas; los botones quedan siempre a la vista */}
              <ScrollView className="max-h-[440px]" showsVerticalScrollIndicator={false}>
              {/* Fotos del taller */}
              {mecanico.tipo === 'taller' ? <SliderFotosTaller tallerId={mecanico.id} /> : null}

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

              {/* Mecánicos del taller y sus estrellas (aparte de las reseñas del taller) */}
              {mecanico.tipo === 'taller' && mecanico.adherido ? (
                <View testID="mecanicos-taller" className="mt-3 flex-row items-center gap-2">
                  <Ionicons name="people-outline" size={15} color={COLORES.textoTenue} />
                  <Text className="text-xs text-texto-tenue">
                    {mecanico.cantidad_mecanicos} {mecanico.cantidad_mecanicos === 1 ? 'mecánico' : 'mecánicos'}
                  </Text>
                  {mecanico.calificacion_mecanicos != null ? (
                    <>
                      <Text className="text-xs text-texto-sutil">·</Text>
                      <Ionicons name="star" size={12} color={COLORES.acento} />
                      <Text className="text-xs text-texto-tenue">
                        {mecanico.calificacion_mecanicos.toFixed(1)} sus mecánicos ({mecanico.calificaciones_mecanicos})
                      </Text>
                    </>
                  ) : null}
                </View>
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

              {/* Taller no adherido: nadie lo atiende por la app, solo se lo puede llamar */}
              {!mecanico.adherido ? (
                <View
                  testID="aviso-no-adherido"
                  className="mt-4 flex-row items-start gap-2 rounded-xl border border-borde bg-fondo px-3.5 py-2.5">
                  <Ionicons name="information-circle-outline" size={17} color={COLORES.textoTenue} />
                  <Text className="flex-1 text-xs text-texto-tenue">
                    {mecanico.tipo === 'taller' ? 'Este taller' : 'Este mecánico'} todavía no recibe pedidos
                    por la app. Podés llamarlo para consultar, o pedir auxilio con el SOS.
                  </Text>
                </View>
              ) : null}

              {/* Reseñas del taller */}
              {mecanico.tipo === 'taller' ? <ResenasTaller tallerId={mecanico.id} /> : null}
              </ScrollView>

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

                {mecanico.adherido ? (
                  <View className="flex-[1.5]">
                    <Boton
                      testID="btn-solicitar-a-taller"
                      titulo="Solicitar asistencia"
                      icono="warning-outline"
                      accessibilityLabel="Solicitar asistencia"
                      accessibilityHint={
                        mecanico.tipo === 'taller'
                          ? 'Abre el formulario de solicitud; la toma un mecánico de este taller'
                          : 'Abre el formulario de solicitud para este mecánico'
                      }
                      onPress={solicitarAuxilio}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

