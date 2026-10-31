
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { IndicadorPasos } from '@/components/solicitud/indicador-pasos';
import { MapaUbicacion } from '@/components/solicitud/mapa-ubicacion';
import { SelectorCategoria } from '@/components/solicitud/selector-categoria';
import { Boton, CampoTexto, Cargando, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import {
  coordenadasComoTexto,
  crearSolicitud,
  listarCategoriasAveria,
  obtenerDireccion,
  obtenerUbicacionActual,
} from '@/services';
import type { CategoriaAveria, PasoSolicitud, UbicacionServicio } from '@/types';

const PASOS: PasoSolicitud[] = [
  { numero: 1, titulo: 'Problema' },
  { numero: 2, titulo: 'Ubicación' },
  { numero: 3, titulo: 'Detalles' },
  { numero: 4, titulo: 'Confirmar' },
];

const MAX_DESCRIPCION = 200;

export default function NuevaSolicitudScreen() {
  const router = useRouter();

  const categorias = useRecurso<CategoriaAveria[]>(listarCategoriasAveria, []);

  const [paso, setPaso] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  /** Coordenadas elegidas: las del GPS o las del pin si el usuario lo movió. */
  const [ubicacion, setUbicacion] = useState<UbicacionServicio | null>(null);
  const [direccion, setDireccion] = useState('');
  const [buscandoGps, setBuscandoGps] = useState(false);
  /** RNF-PRIV-002: el permiso se pide recién al llegar al paso de ubicación. */
  const [gpsPedido, setGpsPedido] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [resolviendoDireccion, setResolviendoDireccion] = useState(false);
  const [mapaActivo, setMapaActivo] = useState(false);
  /** Descarta respuestas de geocodificación que llegan después de un movimiento más nuevo. */
  const consultaRef = useRef(0);

  const buscarUbicacion = useCallback(async () => {
    const consulta = ++consultaRef.current;
    setGpsPedido(true);
    setBuscandoGps(true);
    setErrorGps(null);

    try {
      const actual = await obtenerUbicacionActual();
      if (consulta !== consultaRef.current) return;
      setUbicacion(actual);
      setDireccion(actual.direccion);
    } catch (error) {
      if (consulta !== consultaRef.current) return;
      setErrorGps(error instanceof Error ? error.message : 'No pudimos obtener tu ubicación.');
    } finally {
      if (consulta === consultaRef.current) setBuscandoGps(false);
    }
  }, []);

  /** El usuario arrastró el pin o tocó el mapa: se guardan esas coordenadas. */
  const moverPin = useCallback(async (latitud: number, longitud: number) => {
    const consulta = ++consultaRef.current;
    setBuscandoGps(false);
    setUbicacion({ latitud, longitud, direccion: coordenadasComoTexto(latitud, longitud) });
    setResolviendoDireccion(true);

    const resultado = await obtenerDireccion(latitud, longitud);
    if (consulta !== consultaRef.current) return;

    setUbicacion({ latitud, longitud, ...resultado });
    setDireccion(resultado.direccion);
    setResolviendoDireccion(false);
  }, []);

  const categoriaElegida =
    categorias.datos.find((c) => c.codigo === categoria) ?? null;

  const esUltimoPaso = paso === PASOS.length;

  const retroceder = useCallback(() => {
    if (paso > 1) {
      setPaso((prev) => prev - 1);
    } else {
      router.back();
    }
  }, [paso, router]);

  /**
   * RF-VIEW-006: Botón Atrás de Android vuelve al paso anterior del flujo de solicitud.
   * - En pasos 2 a 4 vuelve al paso anterior conservando los datos cargados (CP-SOL-08).
   * - En el paso 1 permite la salida coherente del flujo (CP-SOL-09).
   */
  useEffect(() => {
    const alPresionarAtras = () => {
      if (paso > 1) {
        retroceder();
        return true;
      }
      return false;
    };

    const suscripcion = BackHandler.addEventListener('hardwareBackPress', alPresionarAtras);
    return () => suscripcion.remove();
  }, [paso, retroceder]);

  const avanzar = async () => {
    if (paso === 1 && !categoriaElegida) {
      Alert.alert('Falta elegir un problema', 'Seleccioná el tipo de asistencia.');
      return;
    }

    if (paso === 2 && (!ubicacion || !direccion.trim())) {
      Alert.alert(
        'Falta la ubicación',
        'Usá tu ubicación actual o marcá en el mapa dónde necesitás asistencia.',
      );
      return;
    }

    if (!esUltimoPaso) {
      if (paso === 1 && !gpsPedido) void buscarUbicacion();
      setPaso(paso + 1);
      return;
    }

    if (!categoriaElegida || !ubicacion || enviando) return;

    setEnviando(true);

    try {
      const { id, codigo } = await crearSolicitud({
        categoriaId: categoriaElegida.id,
        descripcion,
        ubicacion: { ...ubicacion, direccion: direccion.trim() },
      });

      router.replace({ pathname: '/solicitud/confirmada', params: { id, codigo } });
    } catch (error) {
      Alert.alert(
        'No se pudo enviar la solicitud',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center px-3 pb-2 pt-1">
          <Pressable
            testID="btn-retroceder"
            accessibilityRole="button"
            accessibilityLabel="Volver al paso anterior"
            hitSlop={10}
            onPress={retroceder}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="arrow-back" size={23} color={COLORES.texto} />
          </Pressable>

          <View className="flex-1">
            <Text className="text-lg font-extrabold text-texto">
              Solicitar asistencia
            </Text>
            <Text className="text-mini text-texto-tenue">
              Paso {paso} de {PASOS.length}
            </Text>
          </View>
        </View>

        <IndicadorPasos pasos={PASOS} pasoActual={paso} />

        <ScrollView
          className="flex-1"
          scrollEnabled={!mapaActivo}
          contentContainerClassName="gap-4 px-4 pb-5 pt-3"
          keyboardShouldPersistTaps="handled"
        >
          {paso === 1 ? (
            <View className="gap-3">
              <View>
                <Text className="text-xl font-extrabold text-texto">
                  ¿Qué problema tenés?
                </Text>
                <Text className="text-chico text-texto-tenue">
                  Elegí el tipo de asistencia que necesitás.
                </Text>
              </View>

              {categorias.cargando ? (
                <Cargando mensaje="Cargando categorías..." />
              ) : categorias.datos.length === 0 ? (
                <Tarjeta className="p-4">
                  <Text className="text-sm text-texto">
                    No pudimos cargar las categorías. Revisá tu conexión e intentá
                    nuevamente.
                  </Text>
                  <Boton
                    titulo="Reintentar"
                    onPress={categorias.recargar}
                    variante="secundario"
                  />
                </Tarjeta>
              ) : (
                <SelectorCategoria
                  categorias={categorias.datos}
                  seleccionada={categoria}
                  onSeleccionar={setCategoria}
                />
              )}
            </View>
          ) : null}

          {paso === 2 ? (
            <View className="gap-3">
              <View className="flex-row items-end justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-xl font-extrabold text-texto">
                    Tu ubicación
                  </Text>
                  <Text className="text-chico text-texto-tenue">
                    Usamos tu ubicación solo para que el mecánico llegue a vos. Arrastrá el pin o
                    tocá el mapa para ajustar el punto exacto.
                  </Text>
                </View>

                <Pressable
                  testID="btn-usar-ubicacion"
                  accessibilityRole="button"
                  accessibilityLabel="Usar mi ubicación actual"
                  disabled={buscandoGps}
                  onPress={buscarUbicacion}
                  className="flex-row items-center gap-1.5 active:opacity-60"
                >
                  <Text className="text-mini font-bold text-acento">
                    {buscandoGps ? 'Buscando...' : 'Usar mi ubicación'}
                  </Text>
                  <Ionicons name="locate" size={17} color={COLORES.acento} />
                </Pressable>
              </View>

              <MapaUbicacion
                ubicacion={ubicacion}
                onMover={moverPin}
                onInteraccion={setMapaActivo}
              />

              {errorGps && !ubicacion ? (
                <Tarjeta className="flex-row gap-3 border-acento/40 p-3">
                  <Ionicons name="alert-circle-outline" size={19} color={COLORES.acento} />
                  <Text className="flex-1 text-chico text-texto">{errorGps}</Text>
                </Tarjeta>
              ) : null}

              {buscandoGps && !ubicacion ? (
                <Cargando mensaje="Obteniendo tu ubicación..." />
              ) : (
                <Tarjeta className="gap-3 p-3">
                  <CampoTexto
                    testID="campo-direccion"
                    etiqueta="Dirección de asistencia"
                    placeholder={ubicacion ? 'Ingresá la dirección' : 'Marcá primero tu ubicación en el mapa'}
                    icono="location-outline"
                    value={direccion}
                    onChangeText={setDireccion}
                    editable={!!ubicacion}
                    accessibilityLabel="Dirección de asistencia"
                  />

                  <Text className="text-mini text-texto-tenue">
                    {resolviendoDireccion
                      ? 'Buscando la dirección del punto marcado...'
                      : 'Podés corregir la dirección. Las coordenadas son las del pin.'}
                  </Text>

                  {ubicacion ? (
                    <Text testID="texto-coordenadas" className="text-mini text-texto-tenue">
                      Coordenadas: {ubicacion.latitud.toFixed(5)}, {ubicacion.longitud.toFixed(5)}
                    </Text>
                  ) : null}
                </Tarjeta>
              )}
            </View>
          ) : null}

          {paso === 3 ? (
            <View className="gap-3">
              <View>
                <Text className="text-xl font-extrabold text-texto">
                  ¿Necesitás algo más?
                </Text>
                <Text className="text-chico text-texto-tenue">
                  Podés agregar información adicional (opcional).
                </Text>
              </View>

              <CampoTexto
                testID="campo-descripcion"
                placeholder="Ej: El vehículo no enciende o escucho un ruido raro."
                multiline
                value={descripcion}
                onChangeText={setDescripcion}
                maxLength={MAX_DESCRIPCION}
              />

              <Text className="self-end text-mini text-texto-tenue">
                {descripcion.length}/{MAX_DESCRIPCION}
              </Text>
            </View>
          ) : null}

          {paso === 4 ? (
            <View className="gap-3">
              <View>
                <Text className="text-xl font-extrabold text-texto">
                  Confirmá tu solicitud
                </Text>
                <Text className="text-chico text-texto-tenue">
                  Revisá los datos antes de enviarla.
                </Text>
              </View>

              <Tarjeta className="gap-4 p-4">
                <FilaResumen
                  icono="build-outline"
                  titulo="Problema"
                  valor={categoriaElegida?.nombre ?? 'Sin seleccionar'}
                />
                <FilaResumen
                  icono="location-outline"
                  titulo="Ubicación"
                  valor={
                    ubicacion
                      ? `${direccion || 'Sin dirección'}\n${ubicacion.latitud.toFixed(5)}, ${ubicacion.longitud.toFixed(5)}`
                      : 'Sin ubicación'
                  }
                />
                <FilaResumen
                  icono="document-text-outline"
                  titulo="Descripción"
                  valor={descripcion.trim() || 'Sin descripción'}
                />
              </Tarjeta>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-borde px-4 pb-4 pt-3">
          <Boton
            testID="btn-continuar"
            titulo={esUltimoPaso ? 'Confirmar solicitud' : 'Continuar'}
            iconoDerecha={esUltimoPaso ? 'checkmark' : 'arrow-forward'}
            cargando={enviando}
            deshabilitado={enviando}
            onPress={avanzar}
          />
        </View>
      </KeyboardAvoidingView>
    </Pantalla>
  );
}

function FilaResumen({
  icono,
  titulo,
  valor,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  valor: string;
}) {
  return (
    <View className="flex-row gap-3">
      <Ionicons name={icono} size={19} color={COLORES.textoTenue} />
      <View className="flex-1">
        <Text className="text-mini font-bold uppercase tracking-wide text-texto-tenue">
          {titulo}
        </Text>
        <Text className="text-sm text-texto">{valor}</Text>
      </View>
    </View>
  );
}

