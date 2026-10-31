import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Boton, Cargando, ListaVacia, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { formatearMoneda } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { obtenerSolicitud, obtenerUsuarioId, registrarPagoSimulado } from '@/services';
import type { Servicio } from '@/types';

type DetallePago = { servicio: Servicio | null; usuarioId: string };

export default function PagoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const solicitudId = Array.isArray(id) ? id[0] : id;
  const recurso = useRecurso<DetallePago | null>(
    () =>
      solicitudId
        ? Promise.all([obtenerSolicitud(solicitudId), obtenerUsuarioId()]).then(
            ([servicio, usuarioId]) => ({ servicio, usuarioId }),
          )
        : Promise.resolve(null),
    null,
    [solicitudId],
  );
  const [pagando, setPagando] = useState(false);
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const servicio = recurso.datos?.servicio ?? null;
  const esCliente = servicio?.cliente_id === recurso.datos?.usuarioId;
  const pagoCompleto = servicio?.estado_pago === 'pagado' || pagoConfirmado;
  const monto = servicio?.monto_final;
  const puedePagar =
    esCliente && servicio?.estado === 'finalizado' && monto != null && monto > 0;

  async function confirmarPago() {
    if (!servicio || !puedePagar || pagando || pagoCompleto) return;

    setPagando(true);
    try {
      await registrarPagoSimulado(servicio.id);
      setPagoConfirmado(true);
      recurso.recargar();
    } catch (error) {
      Alert.alert(
        'No se pudo procesar el pago',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setPagando(false);
    }
  }

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <View className="flex-row items-center px-3 pb-2 pt-1">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/solicitudes')
          }
          className="mr-3 h-10 w-10 items-center justify-center rounded-full active:opacity-60">
          <Ionicons name="arrow-back" size={23} color={COLORES.texto} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-texto">Pago del servicio</Text>
          {servicio ? (
            <Text className="text-mini text-texto-tenue">{servicio.codigo}</Text>
          ) : null}
        </View>
      </View>

      {recurso.cargando && !servicio ? (
        <Cargando mensaje="Cargando detalles de pago..." />
      ) : recurso.error && !servicio ? (
        <View className="gap-4 px-6 py-10">
          <ListaVacia
            titulo="No pudimos cargar la solicitud"
            detalle={recurso.error}
            icono="cloud-offline-outline"
          />
          <Boton titulo="Reintentar" variante="secundario" onPress={recurso.recargar} />
        </View>
      ) : !servicio ? (
        <ListaVacia
          titulo="Solicitud no encontrada"
          detalle="Verificá que el identificador sea correcto."
          icono="search-outline"
        />
      ) : (
        <ScrollView
          contentContainerClassName="gap-4 px-4 pb-8 pt-3"
          showsVerticalScrollIndicator={false}>
          <Tarjeta className="gap-4 p-4">
            <Text className="text-lg font-bold text-texto">Resumen del servicio</Text>
            <View className="gap-1">
              <Text className="text-mini text-texto-tenue">SOLICITUD</Text>
              <Text className="text-base font-semibold text-texto">{servicio.codigo}</Text>
            </View>
            <View className="gap-1">
              <Text className="text-mini text-texto-tenue">MECÁNICO</Text>
              <Text className="text-base font-semibold text-texto">
                {servicio.mecanico?.nombre ?? 'Mecánico asignado'}
              </Text>
            </View>
            <View className="gap-1 border-t border-borde pt-3">
              <Text className="text-mini text-texto-tenue">MONTO TOTAL</Text>
              <Text testID="texto-monto-pago" className="text-3xl font-black text-texto">
                {monto != null ? formatearMoneda(monto) : '—'}
              </Text>
            </View>
          </Tarjeta>

          <Tarjeta className="gap-3 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-acento/15">
                <Ionicons name="card-outline" size={21} color={COLORES.acento} />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-texto">Pago de prueba</Text>
                <Text className="text-mini text-texto-tenue">
                  Este flujo es simulado; no se realizará ningún cobro real.
                </Text>
              </View>
            </View>
            <View className="rounded-campo border border-borde bg-superficie-alta px-4 py-3">
              <Text className="text-sm font-semibold text-texto">Medio de pago simulado</Text>
              <Text className="text-mini text-texto-tenue">Sin tarjeta ni datos bancarios</Text>
            </View>
          </Tarjeta>

          {pagoCompleto ? (
            <Tarjeta
              testID="pago-confirmado"
              className="items-center gap-3 border-exito/40 p-5">
              <Ionicons name="checkmark-circle" size={44} color={COLORES.exito} />
              <Text className="text-center text-lg font-bold text-texto">Pago confirmado</Text>
              <Text className="text-center text-chico text-texto-tenue">
                El pago simulado quedó registrado correctamente.
              </Text>
              <Boton
                titulo="Volver al seguimiento"
                variante="secundario"
                onPress={() =>
                  router.replace({
                    pathname: '/solicitud/[id]',
                    params: { id: servicio.id },
                  })
                }
              />
            </Tarjeta>
          ) : !puedePagar ? (
            <ListaVacia
              titulo={esCliente ? 'El pago todavía no está disponible' : 'Pago no disponible'}
              detalle={
                esCliente
                  ? 'Se habilita cuando el servicio esté finalizado y tenga un monto registrado.'
                  : 'Solo quien solicitó el servicio puede confirmar su pago.'
              }
              icono="time-outline"
            />
          ) : (
            <Boton
              testID="btn-confirmar-pago"
              titulo="Confirmar pago simulado"
              icono="checkmark-circle-outline"
              cargando={pagando}
              deshabilitado={pagando}
              onPress={() => void confirmarPago()}
            />
          )}
        </ScrollView>
      )}
    </Pantalla>
  );
}
