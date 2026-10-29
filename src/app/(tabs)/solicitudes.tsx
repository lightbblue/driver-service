import { useFocusEffect, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { TarjetaSolicitud } from '@/components/solicitud/tarjeta-solicitud';
import { Boton, Cargando, EncabezadoSeccion, ListaVacia, Pantalla } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import { esEstadoActivo, listarSolicitudes } from '@/services';
import type { Servicio } from '@/types';

/** Mis solicitudes (RF-VIEW-009): las activas primero y después el historial. */
export default function SolicitudesScreen() {
  const router = useRouter();
  const { datos: solicitudes, cargando, error, recargar } = useRecurso<Servicio[]>(
    listarSolicitudes,
    [],
  );

  // Al volver del detalle (por ejemplo, después de cancelar) la lista se actualiza.
  useFocusEffect(recargar);

  const activas = solicitudes.filter((s) => esEstadoActivo(s.estado));
  const finalizadas = solicitudes.filter((s) => !esEstadoActivo(s.estado));

  const abrir = (solicitud: Servicio) =>
    router.push({ pathname: '/solicitud/[id]', params: { id: solicitud.id } });

  return (
    <Pantalla>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-4 pb-10 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={cargando && solicitudes.length > 0}
            onRefresh={recargar}
            tintColor={COLORES.acento}
            colors={[COLORES.acento]}
            progressBackgroundColor={COLORES.superficie}
          />
        }>
        <View className="gap-1 pt-2">
          <Text className="text-3xl font-extrabold text-texto">Mis solicitudes</Text>
          <Text className="text-sm text-texto-tenue">Consultá el estado de tus asistencias.</Text>
        </View>

        {cargando && solicitudes.length === 0 ? (
          <Cargando mensaje="Cargando tus solicitudes…" />
        ) : error ? (
          <View className="gap-2">
            <ListaVacia
              titulo="No pudimos cargar tus solicitudes"
              detalle={error}
              icono="cloud-offline-outline"
            />
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={recargar} />
          </View>
        ) : solicitudes.length === 0 ? (
          <View className="gap-2">
            <ListaVacia
              titulo="Todavía no tenés solicitudes"
              detalle="Cuando pidas asistencia, vas a poder seguirla desde acá."
              icono="document-text-outline"
            />
            <Boton
              titulo="Solicitar asistencia"
              icono="warning"
              onPress={() => router.push('/solicitud/nueva')}
            />
          </View>
        ) : (
          <>
            {activas.length > 0 ? (
              <View>
                <EncabezadoSeccion titulo="En curso" />
                <View className="gap-3">
                  {activas.map((s) => (
                    <TarjetaSolicitud key={s.id} solicitud={s} onPress={() => abrir(s)} />
                  ))}
                </View>
              </View>
            ) : null}

            {finalizadas.length > 0 ? (
              <View>
                <EncabezadoSeccion titulo="Historial" />
                <View className="gap-3">
                  {finalizadas.map((s) => (
                    <TarjetaSolicitud key={s.id} solicitud={s} onPress={() => abrir(s)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Pantalla>
  );
}
