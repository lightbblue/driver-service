import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Pantalla } from '@/components/ui';
import { formatearDistancia } from '@/lib/formato';
import { iconoDeCategoria } from '@/lib/iconos';
import { COLORES } from '@/lib/tema';
import { textoVehiculo } from '@/lib/vehiculo';
import { calcularDistanciaKm } from '@/services/mecanicos';
import { listarSolicitudesMecanico, suscribirseASolicitudes } from '@/services/solicitudes';
import type { Servicio } from '@/types';

import type { Coordenadas, MapaLeafletRef, MarcadorMapa } from './mapa-escena';
import { MapaLeaflet } from './mapa-leaflet';

// Zona por defecto (Pilar) y zoom inicial cuando no hay GPS.
const CENTRO_POR_DEFECTO: Coordenadas = { latitud: -34.5185, longitud: -58.9892 };
const ZOOM_ZONA = 13;
const ZOOM_SOLICITUD = 15;
const ID_YO = 'yo';

type SolicitudEnMapa = { servicio: Servicio; distanciaKm: number | null };

/**
 * Mapa del mecánico: en vez de talleres, un punto por cada solicitud abierta
 * (pendiente y sin mecánico) en el lugar donde está el cliente con la avería.
 */
export function MapaSolicitudesMecanico({ mecanicoId }: { mecanicoId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapaRef = useRef<MapaLeafletRef>(null);

  const [posicion, setPosicion] = useState<Coordenadas | null>(null);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [disponibles, setDisponibles] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const obtenerPosicion = useCallback(async () => {
    setBuscandoGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermisoDenegado(true);
        return;
      }
      setPermisoDenegado(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
      setPosicion(coords);
      mapaRef.current?.volarA(coords, ZOOM_ZONA);
    } catch (error) {
      console.warn('[MAPA] No se pudo obtener la posición GPS:', error);
    } finally {
      setBuscandoGps(false);
    }
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const { disponibles: abiertas } = await listarSolicitudesMecanico(mecanicoId);
      setDisponibles(abiertas);
    } catch (error) {
      console.error('[MAPA] Error al listar solicitudes abiertas:', error);
      setErrorCarga('No se pudieron obtener las solicitudes. Comprobá tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [mecanicoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void obtenerPosicion();
  }, [obtenerPosicion]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  // Las solicitudes nuevas (o tomadas por otro mecánico) se reflejan solas en el mapa.
  useEffect(() => suscribirseASolicitudes(() => void cargar()), [cargar]);

  // Solo las que tienen un punto real en el mapa, de la más cercana a la más lejana.
  const solicitudes = useMemo<SolicitudEnMapa[]>(
    () =>
      disponibles
        .filter((s) => s.ubicacion.latitud !== 0 || s.ubicacion.longitud !== 0)
        .map((servicio) => ({
          servicio,
          distanciaKm: posicion
            ? calcularDistanciaKm(
                posicion.latitud,
                posicion.longitud,
                servicio.ubicacion.latitud,
                servicio.ubicacion.longitud,
              )
            : null,
        }))
        .sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity)),
    [disponibles, posicion],
  );

  const seleccionada = solicitudes.find((s) => s.servicio.id === seleccionadaId) ?? null;

  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const puntos: MarcadorMapa[] = solicitudes.map(({ servicio }) => ({
      id: servicio.id,
      latitud: servicio.ubicacion.latitud,
      longitud: servicio.ubicacion.longitud,
      tipo: 'cliente',
    }));
    return posicion ? [...puntos, { id: ID_YO, ...posicion, tipo: 'yo' }] : puntos;
  }, [solicitudes, posicion]);

  const tocarMarcador = useCallback(
    (id: string) => {
      if (id === ID_YO) return;
      const solicitud = solicitudes.find((s) => s.servicio.id === id);
      if (!solicitud) return;
      setSeleccionadaId(id);
      mapaRef.current?.volarA(
        { latitud: solicitud.servicio.ubicacion.latitud, longitud: solicitud.servicio.ubicacion.longitud },
        ZOOM_SOLICITUD,
      );
    },
    [solicitudes],
  );

  const centrarEnMi = () => {
    if (posicion) mapaRef.current?.volarA(posicion, ZOOM_ZONA);
    else void obtenerPosicion();
  };

  return (
    <Pantalla bordes={['left', 'right']}>
      <View className="relative flex-1 bg-fondo">
        <MapaLeaflet
          ref={mapaRef}
          marcadores={marcadores}
          centroInicial={posicion ?? CENTRO_POR_DEFECTO}
          zoomInicial={ZOOM_ZONA}
          onTocarMarcador={tocarMarcador}
        />

        {/* Encabezado flotante */}
        <View style={{ paddingTop: Math.max(insets.top, 14) }} className="absolute left-0 right-0 top-0 px-4">
          <View className="flex-row items-center justify-between rounded-2xl border border-borde bg-superficie/95 p-3.5 shadow-lg">
            <View className="flex-1 pr-3">
              <Text className="text-base font-extrabold text-texto">Averías cerca tuyo</Text>
              <Text className="text-micro font-medium text-texto-tenue">
                {cargando
                  ? 'Buscando solicitudes abiertas...'
                  : errorCarga
                    ? 'No se pudo cargar el mapa'
                    : solicitudes.length === 0
                      ? 'No hay solicitudes abiertas por ahora'
                      : `${solicitudes.length} ${solicitudes.length === 1 ? 'solicitud abierta' : 'solicitudes abiertas'}`}
              </Text>
            </View>
            {cargando ? (
              <ActivityIndicator color={COLORES.acento} size="small" />
            ) : (
              <Pressable
                onPress={() => void cargar()}
                accessibilityRole="button"
                accessibilityLabel="Actualizar solicitudes"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta active:opacity-70">
                <Ionicons name="reload" size={16} color={COLORES.acento} />
              </Pressable>
            )}
          </View>

          {permisoDenegado ? (
            <View className="mt-2.5 flex-row items-center justify-between rounded-xl border border-acento/30 bg-superficie p-2.5">
              <View className="flex-1 flex-row items-center gap-2">
                <Ionicons name="warning-outline" size={17} color={COLORES.acento} />
                <Text className="flex-1 text-mini text-texto-tenue">GPS inactivo. Mostrando zona por defecto.</Text>
              </View>
              <Pressable
                onPress={() => void obtenerPosicion()}
                accessibilityRole="button"
                accessibilityLabel="Activar permisos de GPS"
                className="rounded-lg bg-acento/10 px-2 py-1">
                <Text className="text-mini font-bold text-acento">Activar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Botón para volver a centrar en el mecánico */}
        {!seleccionada ? (
          <View className="absolute bottom-6 right-5">
            <Pressable
              testID="btn-centrar-usuario"
              accessibilityRole="button"
              accessibilityLabel="Centrar mapa en mi ubicación"
              onPress={centrarEnMi}
              className="items-center justify-center rounded-full border border-borde bg-superficie shadow-xl active:bg-superficie-alta"
              style={{ width: 50, height: 50 }}>
              {buscandoGps ? (
                <ActivityIndicator size="small" color={COLORES.acento} />
              ) : (
                <Ionicons name="locate" size={24} color={posicion ? COLORES.acento : COLORES.textoTenue} />
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Error de conexión con reintento */}
        {errorCarga ? (
          <View
            testID="estado-error-mapa"
            className="absolute bottom-24 left-4 right-4 rounded-2xl border border-peligro/30 bg-superficie/95 p-4 shadow-xl">
            <View className="flex-row items-center gap-3">
              <Ionicons name="alert-circle-outline" size={22} color={COLORES.peligro} />
              <Text className="flex-1 text-chico text-texto-tenue">{errorCarga}</Text>
              <Pressable
                onPress={() => void cargar()}
                accessibilityRole="button"
                accessibilityLabel="Reintentar carga de solicitudes"
                className="rounded-lg border border-borde bg-superficie-alta px-3 py-1.5">
                <Text className="text-mini font-bold text-acento">Reintentar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Tarjeta de la solicitud tocada */}
        {seleccionada ? (
          <View
            testID="tarjeta-solicitud-mapa"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-3xl border-t border-borde bg-superficie px-5 pt-4 shadow-2xl">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-superficie-alta">
                <Ionicons
                  name={iconoDeCategoria(seleccionada.servicio.categoria_icono ?? '')}
                  size={20}
                  color={COLORES.acento}
                />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-bold text-texto">{seleccionada.servicio.categoria_nombre}</Text>
                <Text className="text-mini text-texto-tenue">
                  {seleccionada.servicio.cliente?.nombre ?? 'Cliente'} · {formatearDistancia(seleccionada.distanciaKm)}
                </Text>
              </View>
              <Pressable
                onPress={() => setSeleccionadaId(null)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORES.textoTenue} />
              </Pressable>
            </View>

            <View className="flex-row items-center gap-1.5">
              <Ionicons name="location-outline" size={14} color={COLORES.textoTenue} />
              <Text className="flex-1 text-chico text-texto-tenue" numberOfLines={2}>
                {seleccionada.servicio.ubicacion.direccion}
              </Text>
            </View>

            {textoVehiculo(seleccionada.servicio) ? (
              <Text className="text-chico font-semibold text-texto">{textoVehiculo(seleccionada.servicio)}</Text>
            ) : null}

            {seleccionada.servicio.descripcion ? (
              <Text className="text-chico text-texto-tenue" numberOfLines={3}>
                {seleccionada.servicio.descripcion}
              </Text>
            ) : null}

            <Boton
              titulo="Ver solicitud"
              icono="arrow-forward"
              onPress={() => router.push({ pathname: '/solicitud/[id]', params: { id: seleccionada.servicio.id } })}
            />
          </View>
        ) : null}
      </View>
    </Pantalla>
  );
}
