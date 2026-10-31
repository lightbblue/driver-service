import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Boton, Cargando, Distintivos, FondoMarca, ListaVacia, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import { obtenerMisGanancias } from '@/services';
import type { ResumenGanancias } from '@/types';

/**
 * Pantalla de ganancias del mecánico (RF-VIEW-015, RF-PAY-004).
 * - Exclusiva para mecánicos: si un cliente intenta entrar, se le deniega el acceso (RF-AUTH-006, CP-GAN-05).
 * - Muestra los servicios cobrados con el neto (90 %) calculado por el servidor (RN-012, CP-GAN-01).
 * - Muestra el total a liquidar sumando los netos de todos los servicios pagados (CP-GAN-02).
 */
export default function GananciasScreen() {
  const router = useRouter();

  const {
    datos: resumen,
    cargando,
    error,
    recargar,
  } = useRecurso<ResumenGanancias | null>(obtenerMisGanancias, null);

  useFocusEffect(recargar);

  const esNoMecanico = typeof error === 'string' && error.includes('Solo los mecánicos');

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante="ruta" />

      {/* Encabezado */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-superficie active:bg-superficie-alta"
        >
          <Ionicons name="arrow-back" size={20} color={COLORES.texto} />
        </Pressable>

        <Text className="text-lg font-extrabold text-texto">Mis ganancias</Text>

        <Pressable
          testID="btn-recargar"
          accessibilityRole="button"
          accessibilityLabel="Recargar ganancias"
          hitSlop={8}
          onPress={recargar}
          className="h-10 w-10 items-center justify-center rounded-full bg-superficie active:bg-superficie-alta"
        >
          <Ionicons name="refresh-outline" size={19} color={COLORES.texto} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-4 pb-12 pt-2"
      >
        {cargando && !resumen ? (
          <Cargando mensaje="Cargando tus liquidaciones…" />
        ) : esNoMecanico ? (
          /* CP-GAN-05: Cliente sin permiso de acceso */
          <Tarjeta testID="alerta-acceso-denegado" className="gap-3 border-peligro/40 p-5">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-peligro/20">
                <Ionicons name="lock-closed" size={20} color={COLORES.peligro} />
              </View>
              <Text className="flex-1 text-base font-bold text-peligro">
                Acceso restringido
              </Text>
            </View>
            <Text className="text-sm text-texto-tenue">
              Esta sección es exclusiva para mecánicos asociados a un taller verificado de Rider Service.
            </Text>
            <Boton
              titulo="Regresar al inicio"
              variante="secundario"
              icono="home-outline"
              onPress={() => router.replace('/inicio')}
            />
          </Tarjeta>
        ) : error ? (
          <Tarjeta className="gap-3 border-peligro/40 p-4">
            <Text className="text-sm font-bold text-peligro">Error al cargar ganancias</Text>
            <Text className="text-chico text-texto-tenue">{error}</Text>
            <Boton titulo="Reintentar" variante="secundario" onPress={recargar} />
          </Tarjeta>
        ) : resumen ? (
          <>
            {/* Tarjeta de Total a Liquidar (CP-GAN-02) */}
            <Tarjeta testID="tarjeta-total-liquidar" className="gap-3 border-acento/40 bg-superficie p-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-texto-tenue">
                  Total a liquidar
                </Text>
                <View className="flex-row items-center gap-1 rounded-full bg-acento/10 px-2.5 py-1">
                  <Ionicons name="wallet-outline" size={14} color={COLORES.acento} />
                  <Text className="text-mini font-bold text-acento">Comisión 10 %</Text>
                </View>
              </View>

              <Text testID="monto-total-liquidar" className="text-3xl font-black text-acento">
                ${resumen.total_a_liquidar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Text>

              <View className="mt-2 border-t border-borde pt-3">
                <View className="flex-row justify-between py-0.5">
                  <Text className="text-xs text-texto-tenue">Total facturado bruto</Text>
                  <Text className="text-xs font-semibold text-texto">
                    ${resumen.total_bruto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View className="flex-row justify-between py-0.5">
                  <Text className="text-xs text-texto-tenue">Comisión de la plataforma (10 %)</Text>
                  <Text className="text-xs font-semibold text-peligro">
                    -${resumen.total_comisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View className="flex-row justify-between py-0.5">
                  <Text className="text-xs text-texto-tenue">Servicios cobrados</Text>
                  <Text className="text-xs font-semibold text-texto">
                    {resumen.cantidad_servicios}
                  </Text>
                </View>
              </View>
            </Tarjeta>

            {/* Listado de servicios cobrados (CP-GAN-01, CP-GAN-04) */}
            <View className="gap-2 pt-2">
              <Text className="text-base font-bold text-texto">
                Servicios cobrados ({resumen.servicios.length})
              </Text>

              {resumen.servicios.length === 0 ? (
                /* CP-GAN-04: Mecánico sin servicios cobrados */
                <ListaVacia
                  titulo="Sin cobros registrados"
                  detalle="Aquí aparecerán tus servicios una vez que los clientes realicen el pago correspondiente."
                  icono="receipt-outline"
                />
              ) : (
                resumen.servicios.map((item) => (
                  <Tarjeta key={item.id} testID={`pago-${item.id}`} className="gap-2 p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta">
                          <Ionicons name="checkmark-done" size={16} color={COLORES.exito} />
                        </View>
                        <View>
                          <Text className="text-sm font-bold text-texto">
                            {item.codigo_solicitud}
                          </Text>
                          <Text className="text-mini text-texto-tenue">
                            {item.categoria_nombre}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className="text-mini font-semibold uppercase text-exito">
                          Pagado
                        </Text>
                        <Text className="text-mini text-texto-sutil">
                          {new Date(item.fecha_cobro).toLocaleDateString('es-AR')}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-1 rounded-campo bg-superficie-alta p-2.5">
                      <View className="flex-row justify-between py-0.5">
                        <Text className="text-mini text-texto-tenue">Monto del servicio</Text>
                        <Text className="text-mini text-texto">
                          ${item.monto_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View className="flex-row justify-between py-0.5">
                        <Text className="text-mini text-texto-tenue">Comisión plataforma (10 %)</Text>
                        <Text className="text-mini text-peligro">
                          -${item.comision_plataforma.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View className="mt-1 border-t border-borde pt-1 flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-texto">Tu neto a cobrar (90 %)</Text>
                        <Text className="text-sm font-extrabold text-exito">
                          ${item.neto_mecanico.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>
                  </Tarjeta>
                ))
              )}
            </View>
          </>
        ) : null}

        <Distintivos />
      </ScrollView>
    </Pantalla>
  );
}
