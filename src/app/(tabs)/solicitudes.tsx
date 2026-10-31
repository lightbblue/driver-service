import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { TarjetaSolicitud } from '@/components/seguimiento/tarjeta-solicitud';
import {
  Cargando,
  Conmutador,
  EstadoError,
  ListaVacia,
  LogoRider,
  Pantalla,
  type OpcionConmutador,
} from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import {
  listarSolicitudes,
  listarSolicitudesMecanico,
  obtenerMecanicoIdActual,
  suscribirseASolicitudes,
} from '@/services';
import type { Servicio } from '@/types';

type Bandeja = 'asignadas' | 'disponibles';

const BANDEJAS: OpcionConmutador<Bandeja>[] = [
  { valor: 'asignadas', etiqueta: 'Mis servicios', icono: 'construct-outline' },
  { valor: 'disponibles', etiqueta: 'Disponibles', icono: 'notifications-outline' },
];

type Listado = { esMecanico: boolean; asignadas: Servicio[]; disponibles: Servicio[] };

/** El cliente ve sus solicitudes; el mecánico, sus servicios y los que esperan mecánico. */
async function cargarListado(): Promise<Listado> {
  const mecanicoId = await obtenerMecanicoIdActual();
  if (mecanicoId) {
    return { esMecanico: true, ...(await listarSolicitudesMecanico(mecanicoId)) };
  }
  return { esMecanico: false, asignadas: await listarSolicitudes(), disponibles: [] };
}

/** Mis solicitudes (RF-VIEW-008): datos reales del usuario autenticado. */
export default function SolicitudesScreen() {
  const router = useRouter();
  const listado = useRecurso<Listado | null>(cargarListado, null);
  const { recargar } = listado;
  const [bandeja, setBandeja] = useState<Bandeja>('asignadas');

  useEffect(() => suscribirseASolicitudes(recargar), [recargar]);

  const esMecanico = listado.datos?.esMecanico ?? false;
  const lista = listado.datos?.[esMecanico ? bandeja : 'asignadas'] ?? [];

  return (
    <Pantalla>
      <View className="gap-4 px-4 pb-3 pt-2">
        <LogoRider tamanio="chico" />
        <View>
          <Text className="text-2xl font-extrabold text-texto">
            {esMecanico ? 'Servicios' : 'Mis solicitudes'}
          </Text>
          <Text className="text-chico text-texto-tenue">
            {esMecanico
              ? 'Aceptá solicitudes y registrá cada etapa del servicio.'
              : 'Consultá el estado de tus asistencias.'}
          </Text>
        </View>
        {esMecanico ? <Conmutador opciones={BANDEJAS} valor={bandeja} onCambio={setBandeja} /> : null}
      </View>

      {listado.cargando && !listado.datos ? (
        <Cargando mensaje="Cargando solicitudes..." />
      ) : listado.error && !listado.datos ? (
        <EstadoError
          titulo="No pudimos cargar las solicitudes"
          mensaje={listado.error}
          icono="cloud-offline-outline"
          onReintentar={recargar}
        />
      ) : (
        <ScrollView
          testID="lista-solicitudes"
          contentContainerClassName="gap-3 px-4 pb-barra-inferior pt-1"
          refreshControl={
            <RefreshControl refreshing={listado.cargando} onRefresh={recargar} tintColor="#FFC107" />
          }>
          {lista.length === 0 ? (
            <ListaVacia
              titulo={
                esMecanico && bandeja === 'disponibles'
                  ? 'No hay solicitudes esperando mecánico'
                  : 'Todavía no tenés solicitudes'
              }
              detalle={
                esMecanico
                  ? 'Las nuevas solicitudes aparecen acá automáticamente.'
                  : 'Cuando solicites asistencia, vas a poder seguirla desde acá.'
              }
              icono="file-tray-outline"
              accion={
                !esMecanico
                  ? {
                      texto: 'Solicitar asistencia',
                      icono: 'warning-outline',
                      onPress: () => router.push('/solicitud/nueva'),
                    }
                  : undefined
              }
            />
          ) : (
            lista.map((servicio) => (
              <TarjetaSolicitud
                key={servicio.id}
                servicio={servicio}
                onPress={() => router.push({ pathname: '/solicitud/[id]', params: { id: servicio.id } })}
              />
            ))
          )}
        </ScrollView>
      )}
    </Pantalla>
  );
}
