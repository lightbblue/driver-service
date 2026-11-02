import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Cargando, EstadoError, ListaVacia, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { formatearFechaHora, formatearMoneda } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { NOMBRE_MEDIO, obtenerGanancias, type ResumenGanancias } from '@/services';

/**
 * Mis ganancias del mecánico (RF-VIEW-015, RF-PAY-004): los servicios cobrados, su neto (90 %)
 * de cada uno y el total que le liquida la plataforma.
 */
export default function GananciasScreen() {
  const router = useRouter();
  const recurso = useRecurso<ResumenGanancias | null>(obtenerGanancias, null);
  const datos = recurso.datos;

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <View className="flex-row items-center px-3 pb-2 pt-1">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full active:opacity-60">
          <Ionicons name="arrow-back" size={23} color={COLORES.texto} />
        </Pressable>
        <Text className="text-lg font-extrabold text-texto">Mis ganancias</Text>
      </View>

      {recurso.cargando && !datos ? (
        <Cargando mensaje="Cargando tus ganancias..." />
      ) : recurso.error && !datos ? (
        <EstadoError titulo="No pudimos cargar tus ganancias" mensaje={recurso.error} onReintentar={recurso.recargar} />
      ) : !datos ? null : (
        <ScrollView
          contentContainerClassName="gap-4 px-4 pb-10 pt-2"
          refreshControl={
            <RefreshControl refreshing={recurso.cargando} onRefresh={recurso.recargar} tintColor={COLORES.acento} />
          }>
          {/* Total a liquidar */}
          <Tarjeta testID="total-liquidar" className="gap-1 border-acento/40 p-5">
            <Text className="text-chico text-texto-tenue">Total a liquidar</Text>
            <Text className="text-4xl font-extrabold text-acento">{formatearMoneda(datos.totalALiquidar)}</Text>
            <Text className="text-mini text-texto-tenue">
              Tu neto (90 %) de los servicios cobrados. La transferencia la hace la plataforma.
            </Text>
          </Tarjeta>

          <View className="flex-row gap-3">
            <Tarjeta testID="servicios-cobrados" className="flex-1 gap-1 p-4">
              <Text className="text-mini text-texto-tenue">Servicios cobrados</Text>
              <Text className="text-lg font-extrabold text-texto">{datos.servicios.length}</Text>
            </Tarjeta>
            <Tarjeta testID="comisiones" className="flex-1 gap-1 p-4">
              <Text className="text-mini text-texto-tenue">Comisión de la app</Text>
              <Text className="text-lg font-extrabold text-texto">{formatearMoneda(datos.comisiones)}</Text>
              <Text className="text-micro text-texto-sutil">10 % de lo cobrado</Text>
            </Tarjeta>
          </View>

          <Text className="text-mini font-bold uppercase tracking-wider text-texto-tenue">Servicios</Text>
          {datos.servicios.length === 0 ? (
            <ListaVacia
              titulo="Todavía no tenés servicios cobrados"
              detalle="Cuando un cliente confirme que quedó resuelto, vas a ver acá lo que ganaste."
              icono="wallet-outline"
            />
          ) : (
            datos.servicios.map((s) => (
              <Pressable
                key={s.id}
                testID={`ganancia-${s.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${s.problema}, ${s.codigo}`}
                onPress={() => router.push({ pathname: '/solicitud/[id]', params: { id: s.solicitudId } })}
                className="gap-2 rounded-tarjeta border border-borde bg-superficie p-4 active:bg-superficie-alta">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-texto">{s.problema}</Text>
                    <Text className="text-mini text-texto-tenue">
                      {s.codigo} · {formatearFechaHora(s.fecha)}
                    </Text>
                  </View>
                  <View className="rounded-full bg-exito/15 px-2 py-0.5">
                    <Text className="text-mini font-bold text-exito">Cobrado</Text>
                  </View>
                </View>
                <View className="flex-row items-end justify-between">
                  <Text className="text-mini text-texto-tenue">
                    Cliente pagó {formatearMoneda(s.monto)} · {NOMBRE_MEDIO[s.medio]}
                  </Text>
                  <Text className="text-base font-extrabold text-texto">{formatearMoneda(s.neto)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </Pantalla>
  );
}
