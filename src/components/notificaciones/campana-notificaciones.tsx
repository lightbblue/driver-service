import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableWithoutFeedback, View } from 'react-native';

import { Cargando } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { formatearFechaHora } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { listarNotificaciones, marcarNotificacionesLeidas, suscribirseANotificaciones } from '@/services';
import type { Notificacion } from '@/types';

/**
 * Campana del encabezado con su lista de avisos (RF-NOTIF-001).
 * El punto rojo aparece si hay avisos sin leer; al abrir la lista se marcan como leídos.
 */
export function CampanaNotificaciones({ usuarioId }: { usuarioId: string | null }) {
  const router = useRouter();
  const avisos = useRecurso<Notificacion[]>(listarNotificaciones, []);
  const { recargar } = avisos;
  const [abierta, setAbierta] = useState(false);

  // Avisos nuevos en vivo: la campana se enciende sin recargar.
  useEffect(() => {
    if (!usuarioId) return;
    return suscribirseANotificaciones(usuarioId, recargar);
  }, [usuarioId, recargar]);

  const sinLeer = avisos.datos.filter((a) => !a.leida).length;

  const abrir = () => {
    setAbierta(true);
    if (sinLeer > 0) {
      marcarNotificacionesLeidas()
        .then(recargar)
        .catch((error: unknown) => console.warn('[AVISOS] No se pudieron marcar como leídos:', error));
    }
  };

  // Cada aviso lleva a lo suyo: la solicitud, o Mi taller si es un pedido para sumarse.
  const tieneDestino = (aviso: Notificacion) => aviso.tipo === 'taller' || !!aviso.solicitud_id;
  const irASolicitud = (aviso: Notificacion) => {
    if (!tieneDestino(aviso)) return;
    setAbierta(false);
    if (aviso.tipo === 'taller') router.push('/mi-taller');
    else if (aviso.solicitud_id) router.push({ pathname: '/solicitud/[id]', params: { id: aviso.solicitud_id } });
  };

  return (
    <>
      <Pressable
        testID="btn-notificaciones"
        accessibilityRole="button"
        accessibilityLabel={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
        hitSlop={8}
        onPress={abrir}
        className="h-10 w-10 items-center justify-center rounded-full bg-superficie active:bg-superficie-alta">
        <Ionicons name={sinLeer > 0 ? 'notifications' : 'notifications-outline'} size={19} color={COLORES.texto} />
        {sinLeer > 0 ? (
          <View
            testID="punto-sin-leer"
            className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-fondo bg-peligro px-1">
            <Text className="text-[9px] font-extrabold text-texto">{sinLeer > 9 ? '9+' : sinLeer}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={abierta}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setAbierta(false)}>
        <TouchableWithoutFeedback onPress={() => setAbierta(false)}>
          <View className="flex-1 justify-end bg-black/35">
            <TouchableWithoutFeedback>
              <View testID="modal-notificaciones" className="max-h-[75%] rounded-t-3xl border-t border-borde bg-superficie pb-8 pt-4">
                <View className="mb-3 items-center">
                  <View className="h-1.5 w-12 rounded-full bg-superficie-alta" />
                </View>

                <View className="flex-row items-center justify-between px-5 pb-3">
                  <Text className="text-lg font-extrabold text-texto">Notificaciones</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar notificaciones"
                    hitSlop={8}
                    onPress={() => setAbierta(false)}
                    className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta active:opacity-70">
                    <Ionicons name="close" size={20} color={COLORES.textoTenue} />
                  </Pressable>
                </View>

                {avisos.cargando && avisos.datos.length === 0 ? (
                  <Cargando mensaje="" />
                ) : avisos.datos.length === 0 ? (
                  <View className="items-center gap-2 px-8 py-10">
                    <Ionicons name="notifications-off-outline" size={34} color={COLORES.textoSutil} />
                    <Text className="text-center text-sm font-bold text-texto">No tenés notificaciones</Text>
                    <Text className="text-center text-chico text-texto-tenue">
                      Te avisamos acá cuando cambie el estado de una solicitud o te pidan asistencia.
                    </Text>
                  </View>
                ) : (
                  <ScrollView contentContainerClassName="gap-2 px-4">
                    {avisos.datos.map((aviso) => (
                      <Pressable
                        key={aviso.id}
                        testID={`aviso-${aviso.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={aviso.titulo}
                        disabled={!tieneDestino(aviso)}
                        onPress={() => irASolicitud(aviso)}
                        className={cn(
                          'flex-row gap-3 rounded-tarjeta border p-3 active:bg-superficie-alta',
                          aviso.leida ? 'border-borde bg-superficie' : 'border-acento/40 bg-acento/10',
                        )}>
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-superficie-alta">
                          <Ionicons
                            name={aviso.tipo === 'taller' ? 'storefront-outline' : 'construct-outline'}
                            size={17}
                            color={COLORES.acento}
                          />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-sm font-bold text-texto">{aviso.titulo}</Text>
                          {aviso.cuerpo ? <Text className="text-chico text-texto-tenue">{aviso.cuerpo}</Text> : null}
                          <Text className="text-mini text-texto-sutil">{formatearFechaHora(aviso.creado_en)}</Text>
                        </View>
                        {tieneDestino(aviso) ? (
                          <Ionicons name="chevron-forward" size={16} color={COLORES.textoSutil} />
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
