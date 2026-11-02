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
  esEstadoActivo,
  listarSolicitudes,
  listarSolicitudesMecanico,
  obtenerMecanicoIdActual,
  suscribirseASolicitudes,
} from '@/services';
import type { Servicio } from '@/types';
import { COLORES } from '@/lib/tema';

type Bandeja = 'disponibles' | 'historial';

const BANDEJAS: OpcionConmutador<Bandeja>[] = [
  { valor: 'disponibles', etiqueta: 'Disponibles', icono: 'notifications-outline' },
  { valor: 'historial', etiqueta: 'Historial', icono: 'time-outline' },
];

type Listado = {
  esMecanico: boolean;
  /** Mecánico: los que está atendiendo ahora (van arriba de Disponibles). Cliente: todas sus solicitudes. */
  enCurso: Servicio[];
  disponibles: Servicio[];
  /** Mecánico: los que ya terminaron (finalizados, no resueltos o cancelados). */
  historial: Servicio[];
};

/** El cliente ve sus solicitudes; el mecánico, lo que puede tomar, lo que atiende y su historial. */
async function cargarListado(): Promise<Listado> {
  const mecanicoId = await obtenerMecanicoIdActual();
  if (mecanicoId) {
    const { asignadas, disponibles } = await listarSolicitudesMecanico(mecanicoId);
    return {
      esMecanico: true,
      enCurso: asignadas.filter((s) => esEstadoActivo(s.estado)),
      disponibles,
      historial: asignadas.filter((s) => !esEstadoActivo(s.estado)),
    };
  }
  return { esMecanico: false, enCurso: await listarSolicitudes(), disponibles: [], historial: [] };
}

function Seccion({ titulo }: { titulo: string }) {
  return <Text className="pt-1 text-mini font-bold uppercase tracking-wider text-texto-tenue">{titulo}</Text>;
}

/** Mis solicitudes (RF-VIEW-008): datos reales del usuario autenticado. */
export default function SolicitudesScreen() {
  const router = useRouter();
  const listado = useRecurso<Listado | null>(cargarListado, null);
  const { recargar } = listado;
  // El mecánico entra directo a lo que puede tomar.
  const [bandeja, setBandeja] = useState<Bandeja>('disponibles');

  useEffect(() => suscribirseASolicitudes(recargar), [recargar]);

  const esMecanico = listado.datos?.esMecanico ?? false;
  const enCurso = esMecanico && bandeja === 'disponibles' ? (listado.datos?.enCurso ?? []) : [];
  const lista = !listado.datos
    ? []
    : !esMecanico
      ? listado.datos.enCurso
      : bandeja === 'disponibles'
        ? listado.datos.disponibles
        : listado.datos.historial;
  const abrir = (servicio: Servicio) =>
    router.push({ pathname: '/solicitud/[id]', params: { id: servicio.id } });

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
            <RefreshControl refreshing={listado.cargando} onRefresh={recargar} tintColor={COLORES.acento} />
          }>
          {/* Lo que el mecánico está atendiendo, arriba de lo que puede tomar */}
          {enCurso.length > 0 ? (
            <>
              <Seccion titulo="En curso" />
              {enCurso.map((servicio) => (
                <TarjetaSolicitud key={servicio.id} servicio={servicio} onPress={() => abrir(servicio)} />
              ))}
              <Seccion titulo="Disponibles" />
            </>
          ) : null}

          {lista.length === 0 ? (
            <ListaVacia
              titulo={
                !esMecanico
                  ? 'Todavía no tenés solicitudes'
                  : bandeja === 'disponibles'
                    ? 'No hay solicitudes esperando mecánico'
                    : 'Todavía no terminaste ningún servicio'
              }
              detalle={
                !esMecanico
                  ? 'Cuando solicites asistencia, vas a poder seguirla desde acá.'
                  : bandeja === 'disponibles'
                    ? 'Las nuevas solicitudes aparecen acá automáticamente.'
                    : 'Los servicios finalizados, no resueltos o cancelados van a quedar acá.'
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
              <TarjetaSolicitud key={servicio.id} servicio={servicio} onPress={() => abrir(servicio)} />
            ))
          )}
        </ScrollView>
      )}
    </Pantalla>
  );
}
