import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetalleMecanicoModal } from '@/components/mapa/detalle-mecanico-modal';
import { FilaMecanico } from '@/components/mapa/fila-mecanico';
import { MapaMecanicos, type MapaMecanicosRef } from '@/components/mapa/mapa-mecanicos';
import { Chip, Conmutador, ListaVacia, Pantalla, type OpcionConmutador } from '@/components/ui';
import { COLORES } from '@/lib/tema';
import { listarMecanicos, tieneUbicacion } from '@/services/mecanicos';
import type { Mecanico } from '@/types';

// Coordenadas por defecto (Buenos Aires / Pilar)
const REGION_POR_DEFECTO = {
  latitude: -34.5185,
  longitude: -58.9892,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Vista = 'mapa' | 'lista';

const OPCIONES_VISTA: OpcionConmutador<Vista>[] = [
  { valor: 'mapa', etiqueta: 'Mapa', icono: 'map-outline' },
  { valor: 'lista', etiqueta: 'Lista', icono: 'list-outline' },
];

/**
 * Mecánicos cercanos (RF-VIEW-007) con dos vistas:
 * - Mapa: solo talleres con lugar físico.
 * - Lista: todos los mecánicos, también los de asistencia en ruta (sin ubicación).
 * La vista viaja en el parámetro `vista` para que el Inicio abra la que corresponde.
 */
export default function MapaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapaMecanicosRef | null>(null);
  const params = useLocalSearchParams<{ vista?: string; mecanico?: string }>();
  const vista: Vista = params.vista === 'lista' ? 'lista' : 'mapa';
  const [alturaEncabezado, setAlturaEncabezado] = useState(0);

  const [ubicacionUsuario, setUbicacionUsuario] = useState<{
    latitud: number;
    longitud: number;
  } | null>(null);

  const [mecanicos, setMecanicos] = useState<Mecanico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState<string>('Todos');
  const [mecanicoSeleccionado, setMecanicoSeleccionado] = useState<Mecanico | null>(null);

  // Obtener la ubicación del usuario mediante expo-location
  const obtenerPosicionUsuario = useCallback(async () => {
    setBuscandoGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermisoDenegado(true);
        setBuscandoGps(false);
        return;
      }

      setPermisoDenegado(false);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nuevaUbicacion = {
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
      };

      setUbicacionUsuario(nuevaUbicacion);

      // Centrar el mapa con animación
      mapRef.current?.animateToRegion({
        latitude: nuevaUbicacion.latitud,
        longitude: nuevaUbicacion.longitud,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.warn('[MAPA] No se pudo obtener la posición GPS:', error);
    } finally {
      setBuscandoGps(false);
    }
  }, []);

  // Cargar mecánicos desde Supabase (RF-UX-003: manejo de loading y error)
  const cargarMecanicos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const datos = await listarMecanicos(ubicacionUsuario);
      setMecanicos(datos);
    } catch (error) {
      console.error('[MAPA] Error al listar mecánicos de Supabase:', error);
      setErrorCarga('No se pudieron obtener los mecánicos. Comprobá tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [ubicacionUsuario]);

  // Al montar la pantalla: pedir ubicación y luego cargar mecánicos con ella
  useEffect(() => {
    void (async () => {
      setBuscandoGps(true);
      let posicion: { latitud: number; longitud: number } | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermisoDenegado(true);
        } else {
          setPermisoDenegado(false);
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          posicion = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
          setUbicacionUsuario(posicion);

          mapRef.current?.animateToRegion({
            latitude: posicion.latitud,
            longitude: posicion.longitud,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      } catch (error) {
        console.warn('[MAPA] No se pudo obtener la posición GPS:', error);
      } finally {
        setBuscandoGps(false);
      }

      // Cargar mecánicos usando la posición ya obtenida (no desde el estado)
      setCargando(true);
      setErrorCarga(null);
      try {
        const datos = await listarMecanicos(posicion);
        setMecanicos(datos);
      } catch (error) {
        console.error('[MAPA] Error al listar mecánicos:', error);
        setErrorCarga('No se pudieron obtener los mecánicos. Comprobá tu conexión.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // El mapa muestra solo talleres con lugar físico. Los mecánicos sin ubicación
  // hacen asistencia en la ruta: aparecen en la lista y reciben las solicitudes por "Disponibles".
  const talleres = useMemo(() => mecanicos.filter(tieneUbicacion), [mecanicos]);
  const visibles = vista === 'mapa' ? talleres : mecanicos;

  // Extraer lista de especialidades disponibles para la barra de filtros
  const especialidades = useMemo(() => {
    const conjunto = new Set<string>();
    visibles.forEach((m) => {
      m.especialidades.forEach((esp) => conjunto.add(esp));
    });
    return ['Todos', ...Array.from(conjunto)];
  }, [visibles]);

  // Filtrar según la especialidad seleccionada
  const mecanicosFiltrados = useMemo(() => {
    if (especialidadSeleccionada === 'Todos') {
      return visibles;
    }
    return visibles.filter((m) =>
      m.especialidades.includes(especialidadSeleccionada),
    );
  }, [visibles, especialidadSeleccionada]);

  // El mapa recibe siempre los talleres filtrados, aunque esté oculto detrás de la lista.
  const talleresFiltrados = useMemo(
    () => mecanicosFiltrados.filter(tieneUbicacion),
    [mecanicosFiltrados],
  );

  const cambiarVista = (nueva: Vista) => router.setParams({ vista: nueva });

  // Mecánico pedido desde otra pantalla (por ejemplo, un destacado del Inicio): se abre su ficha.
  const mecanicoPedido = useMemo(
    () => (params.mecanico ? (mecanicos.find((m) => m.id === params.mecanico) ?? null) : null),
    [params.mecanico, mecanicos],
  );
  const fichaAbierta = mecanicoSeleccionado ?? mecanicoPedido;

  // Si el pedido tiene taller, el mapa se centra en él.
  useEffect(() => {
    if (!mecanicoPedido || !tieneUbicacion(mecanicoPedido)) return;
    mapRef.current?.animateToRegion({
      latitude: mecanicoPedido.latitud,
      longitude: mecanicoPedido.longitud,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  }, [mecanicoPedido]);

  const cerrarFicha = () => {
    setMecanicoSeleccionado(null);
    if (params.mecanico) router.setParams({ mecanico: undefined });
  };

  // Abrir la ficha y, si tiene ubicación, centrar el mapa en él
  const seleccionarMecanico = (mecanico: Mecanico) => {
    setMecanicoSeleccionado(mecanico);
    if (!tieneUbicacion(mecanico)) return;
    mapRef.current?.animateToRegion({
      latitude: mecanico.latitud,
      longitude: mecanico.longitud,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  };

  // Re-centrar mapa en la ubicación del usuario
  const centrarEnUsuario = () => {
    if (ubicacionUsuario) {
      mapRef.current?.animateToRegion({
        latitude: ubicacionUsuario.latitud,
        longitude: ubicacionUsuario.longitud,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      });
    } else {
      void obtenerPosicionUsuario();
    }
  };

  return (
    <Pantalla bordes={['left', 'right']}>
      <View className="relative flex-1 bg-fondo">
        {/* Componente del mapa */}
        <MapaMecanicos
          ref={mapRef}
          mecanicos={talleresFiltrados}
          ubicacionUsuario={ubicacionUsuario}
          mecanicoSeleccionado={fichaAbierta}
          onSeleccionarMecanico={seleccionarMecanico}
          regionInicial={
            ubicacionUsuario
              ? {
                  latitude: ubicacionUsuario.latitud,
                  longitude: ubicacionUsuario.longitud,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }
              : REGION_POR_DEFECTO
          }
        />

        {/* Vista Lista: tapa el mapa (que sigue montado para no perder su estado) */}
        {vista === 'lista' ? (
          <FlatList
            testID="lista-mecanicos"
            className="absolute inset-0 bg-fondo"
            data={mecanicosFiltrados}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-4 pb-8"
            contentContainerStyle={{ paddingTop: alturaEncabezado + 8 }}
            renderItem={({ item }) => (
              <FilaMecanico
                mecanico={item}
                tieneTaller={tieneUbicacion(item)}
                onPress={() => seleccionarMecanico(item)}
              />
            )}
            ListEmptyComponent={
              cargando || errorCarga ? undefined : (
                <ListaVacia
                  titulo="Sin mecánicos para este filtro"
                  detalle="Probá con otra especialidad."
                  icono="search-outline"
                />
              )
            }
          />
        ) : null}

        {/* Encabezado flotante superior con título, contador y selector de vista */}
        <View
          onLayout={(e) => setAlturaEncabezado(e.nativeEvent.layout.height)}
          style={{ paddingTop: Math.max(insets.top, 14) }}
          // En la lista lleva fondo sólido para que las filas no se vean por detrás al hacer scroll.
          className={`absolute left-0 right-0 top-0 px-4 ${vista === 'lista' ? 'bg-fondo pb-2' : ''}`}
        >
          <View className="flex-row items-center justify-between rounded-2xl border border-borde bg-superficie/95 p-3.5 shadow-lg backdrop-blur-md">
            <View>
              <Text className="text-base font-extrabold text-texto">
                {vista === 'mapa' ? 'Talleres cerca tuyo' : 'Mecánicos cerca tuyo'}
              </Text>
              <Text className="text-micro font-medium text-texto-tenue">
                {cargando
                  ? 'Buscando prestadores en la zona...'
                  : errorCarga
                    ? 'No se pudo cargar la lista'
                    : mecanicosFiltrados.length === 0
                      ? 'Sin resultados para este filtro'
                      : vista === 'mapa'
                        ? `${mecanicosFiltrados.length} talleres en el mapa`
                        : `${mecanicosFiltrados.length} mecánicos, con taller o en ruta`}
              </Text>
            </View>

            {cargando ? (
              <ActivityIndicator color={COLORES.acento} size="small" />
            ) : (
              <Pressable
                onPress={cargarMecanicos}
                accessibilityRole="button"
                accessibilityLabel="Actualizar lista de mecánicos"
                accessibilityHint="Recarga los talleres disponibles en la zona"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta active:opacity-70"
              >
                <Ionicons name="reload" size={16} color={COLORES.acento} />
              </Pressable>
            )}
          </View>

          <View className="mt-2.5">
            <Conmutador opciones={OPCIONES_VISTA} valor={vista} onCambio={cambiarVista} />
          </View>

          {/* Barra de Filtros por Especialidad */}
          <View className="mt-2.5">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={especialidades}
              keyExtractor={(item) => item}
              contentContainerClassName="gap-2 pb-1"
              renderItem={({ item }) => (
                <Chip
                  texto={item}
                  activo={especialidadSeleccionada === item}
                  accessibilityLabel={`Filtrar por: ${item}`}
                  accessibilityHint={
                    especialidadSeleccionada === item
                      ? 'Filtro actualmente aplicado'
                      : `Muestra solo mecánicos con especialidad en ${item}`
                  }
                  onPress={() => setEspecialidadSeleccionada(item)}
                />
              )}
            />
          </View>

          {/* Aviso si el permiso de GPS está denegado */}
          {permisoDenegado ? (
            <View className="mt-2.5 flex-row items-center justify-between rounded-xl border border-acento/30 bg-superficie p-2.5">
              <View className="flex-1 flex-row items-center gap-2">
                <Ionicons name="warning-outline" size={17} color={COLORES.acento} />
                <Text className="flex-1 text-mini text-texto-tenue">
                  GPS inactivo. Mostrando zona por defecto.
                </Text>
              </View>
              <Pressable
                onPress={obtenerPosicionUsuario}
                accessibilityRole="button"
                accessibilityLabel="Activar permisos de GPS"
                accessibilityHint="Permite acceder a tu ubicación actual para ver mecánicos cercanos"
                className="rounded-lg bg-acento/10 px-2 py-1"
              >
                <Text className="text-mini font-bold text-acento">Activar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Botón flotante para re-centrar en el usuario (FAB) */}
        <View className={vista === 'mapa' ? 'absolute bottom-6 right-5' : 'hidden'}>
          <Pressable
            testID="btn-centrar-usuario"
            accessibilityRole="button"
            accessibilityLabel="Centrar mapa en mi ubicación"
            accessibilityHint="Mueve la vista del mapa a tu posición GPS actual"
            onPress={centrarEnUsuario}
            className="h-13 w-13 items-center justify-center rounded-full border border-borde bg-superficie shadow-xl active:bg-superficie-alta"
            style={{ width: 50, height: 50 }}
          >
            {buscandoGps ? (
              <ActivityIndicator size="small" color={COLORES.acento} />
            ) : (
              <Ionicons
                name="locate"
                size={24}
                color={ubicacionUsuario ? COLORES.acento : COLORES.textoTenue}
              />
            )}
          </Pressable>
        </View>

        {/* Banner de lista vacía en mapa cuando un filtro no tiene talleres (RF-UX-003) */}
        {vista === 'mapa' && !cargando && !errorCarga && mecanicosFiltrados.length === 0 ? (
          <View
            testID="estado-vacio-mapa"
            className="absolute bottom-24 left-4 right-4 rounded-2xl border border-borde bg-superficie/95 p-4 shadow-xl backdrop-blur-md"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-superficie-alta">
                <Ionicons name="search-outline" size={20} color={COLORES.textoTenue} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-texto">
                  Sin talleres en esta categoría
                </Text>
                <Text className="text-micro text-texto-tenue">
                  No hay mecánicos con especialidad en &ldquo;{especialidadSeleccionada}&rdquo;.
                </Text>
              </View>
              <Pressable
                onPress={() => setEspecialidadSeleccionada('Todos')}
                className="rounded-lg bg-acento px-3 py-1.5"
                accessibilityRole="button"
                accessibilityLabel="Ver todos los mecánicos"
              >
                <Text className="text-mini font-bold text-texto-inverso">Ver todos</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Banner de error de conexión en mapa con reintento (RF-UX-003) */}
        {errorCarga ? (
          <View
            testID="estado-error-mapa"
            className="absolute bottom-24 left-4 right-4 rounded-2xl border border-peligro/30 bg-superficie/95 p-4 shadow-xl backdrop-blur-md"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-peligro/15">
                <Ionicons name="alert-circle-outline" size={20} color={COLORES.peligro} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-texto">Error de conexión</Text>
                <Text className="text-micro text-texto-tenue">{errorCarga}</Text>
              </View>
              <Pressable
                onPress={cargarMecanicos}
                className="rounded-lg border border-borde bg-superficie-alta px-3 py-1.5 active:bg-superficie"
                accessibilityRole="button"
                accessibilityLabel="Reintentar carga de mecánicos"
              >
                <Text className="text-mini font-bold text-acento">Reintentar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Modal / BottomSheet de detalles del mecánico seleccionado */}
        <DetalleMecanicoModal
          mecanico={fichaAbierta}
          onCerrar={cerrarFicha}
        />
      </View>
    </Pantalla>
  );
}
