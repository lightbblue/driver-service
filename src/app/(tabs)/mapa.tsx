import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetalleMecanicoModal } from '@/components/mapa/detalle-mecanico-modal';
import { MapaMecanicos } from '@/components/mapa/mapa-mecanicos';
import { Chip, Pantalla } from '@/components/ui';
import { listarMecanicos } from '@/services/mecanicos';
import type { Mecanico } from '@/types';

// Coordenadas por defecto (Buenos Aires / Pilar)
const REGION_POR_DEFECTO = {
  latitude: -34.5185,
  longitude: -58.9892,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/**
 * Pantalla completa de Mapa de Mecánicos Cercanos (RF-VIEW-007).
 * Integra `react-native-maps`, `expo-location` y la consulta a Supabase.
 */
export default function MapaScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const [ubicacionUsuario, setUbicacionUsuario] = useState<{
    latitud: number;
    longitud: number;
  } | null>(null);

  const [mecanicos, setMecanicos] = useState<Mecanico[]>([]);
  const [cargando, setCargando] = useState(true);
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

  // Cargar mecánicos desde Supabase
  const cargarMecanicos = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await listarMecanicos(ubicacionUsuario);
      setMecanicos(datos);
    } catch (error) {
      console.error('[MAPA] Error al listar mecánicos de Supabase:', error);
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
      try {
        const datos = await listarMecanicos(posicion);
        setMecanicos(datos);
      } catch (error) {
        console.error('[MAPA] Error al listar mecánicos:', error);
      } finally {
        setCargando(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extraer lista de especialidades disponibles para la barra de filtros
  const especialidades = useMemo(() => {
    const conjunto = new Set<string>();
    mecanicos.forEach((m) => {
      m.especialidades.forEach((esp) => conjunto.add(esp));
    });
    return ['Todos', ...Array.from(conjunto)];
  }, [mecanicos]);

  // Filtrar mecánicos según la especialidad seleccionada
  const mecánicosFiltrados = useMemo(() => {
    if (especialidadSeleccionada === 'Todos') {
      return mecanicos;
    }
    return mecanicos.filter((m) =>
      m.especialidades.includes(especialidadSeleccionada),
    );
  }, [mecanicos, especialidadSeleccionada]);

  // Centrar en un mecánico al seleccionarlo
  const seleccionarMecanico = (mecanico: Mecanico) => {
    setMecanicoSeleccionado(mecanico);
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
          mecanicos={mecánicosFiltrados}
          ubicacionUsuario={ubicacionUsuario}
          mecanicoSeleccionado={mecanicoSeleccionado}
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

        {/* Encabezado flotante superior con título y contador */}
        <View
          style={{ paddingTop: Math.max(insets.top, 14) }}
          className="absolute left-0 right-0 top-0 px-4"
        >
          <View className="flex-row items-center justify-between rounded-2xl border border-borde bg-superficie/95 p-3.5 shadow-lg backdrop-blur-md">
            <View>
              <Text className="text-base font-extrabold text-texto">
                Mecánicos cerca tuyo
              </Text>
              <Text className="text-micro font-medium text-texto-tenue">
                {cargando
                  ? 'Buscando prestadores en la zona...'
                  : `${mecánicosFiltrados.length} talleres disponibles`}
              </Text>
            </View>

            {cargando ? (
              <ActivityIndicator color="#FFC107" size="small" />
            ) : (
              <Pressable
                onPress={cargarMecanicos}
                accessibilityRole="button"
                accessibilityLabel="Actualizar lista de mecánicos"
                accessibilityHint="Recarga los talleres disponibles en la zona"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-superficie-alta active:opacity-70"
              >
                <Ionicons name="reload" size={16} color="#FFC107" />
              </Pressable>
            )}
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
                <Ionicons name="warning-outline" size={17} color="#FFC107" />
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
        <View className="absolute bottom-6 right-5">
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
              <ActivityIndicator size="small" color="#FFC107" />
            ) : (
              <Ionicons
                name="locate"
                size={24}
                color={ubicacionUsuario ? '#FFC107' : '#9CA3AF'}
              />
            )}
          </Pressable>
        </View>

        {/* Modal / BottomSheet de detalles del mecánico seleccionado */}
        <DetalleMecanicoModal
          mecanico={mecanicoSeleccionado}
          onCerrar={() => setMecanicoSeleccionado(null)}
        />
      </View>
    </Pantalla>
  );
}
