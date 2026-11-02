
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';
import {
  coordenadasComoTexto,
  crearSolicitud,
  listarCategoriasAveria,
  obtenerDireccion,
  obtenerUbicacionActual,
} from '@/services';
import { NOMBRE_VEHICULO } from '@/lib/vehiculo';
import type { CategoriaAveria, PasoSolicitud, TipoVehiculo, UbicacionServicio } from '@/types';

const TIPOS_VEHICULO: { valor: TipoVehiculo; titulo: string; icono: keyof typeof Ionicons.glyphMap }[] = [
  { valor: 'auto', titulo: 'Auto', icono: 'car-sport-outline' },
  { valor: 'moto', titulo: 'Moto', icono: 'bicycle-outline' },
];

const PASOS: PasoSolicitud[] = [
  { numero: 1, titulo: 'Problema' },
  { numero: 2, titulo: 'Ubicación' },
  { numero: 3, titulo: 'Vehículo' },
  { numero: 4, titulo: 'Confirmar' },
];

const MAX_DESCRIPCION = 200;

export default function NuevaSolicitudScreen() {
  const router = useRouter();
  // Desde el modal de un taller (o de un mecánico en ruta) la solicitud va solo a ellos.
  const params = useLocalSearchParams<{ destinoTipo?: string; destinoId?: string; destinoNombre?: string }>();
  const tipoDestino: 'taller' | 'mecanico' | null =
    params.destinoTipo === 'taller' ? 'taller' : params.destinoTipo === 'mecanico' ? 'mecanico' : null;
  const destino =
    tipoDestino && params.destinoId
      ? { tipo: tipoDestino, id: params.destinoId, nombre: params.destinoNombre ?? '' }
      : null;

  const categorias = useRecurso<CategoriaAveria[]>(listarCategoriasAveria, []);

  const [paso, setPaso] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  // El mecánico ve qué vehículo es antes de aceptar.
  const [tipoVehiculo, setTipoVehiculo] = useState<TipoVehiculo | null>(null);
  const [modelo, setModelo] = useState('');
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

  const retroceder = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    } else {
      router.back();
    }
  };

  // Botón Atrás de Android: vuelve al paso anterior en lugar de salir de la solicitud.
  // En el paso 1 no lo intercepta, así sale de la pantalla como siempre.
  useFocusEffect(
    useCallback(() => {
      const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
        if (paso <= 1) return false;
        setPaso(paso - 1);
        return true;
      });
      return () => suscripcion.remove();
    }, [paso]),
  );

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

    if (paso === 3 && (!tipoVehiculo || !modelo.trim())) {
      Alert.alert('Falta el vehículo', 'Indicá si es auto o moto y qué modelo es.');
      return;
    }

    if (!esUltimoPaso) {
      if (paso === 1 && !gpsPedido) void buscarUbicacion();
      setPaso(paso + 1);
      return;
    }

    if (!categoriaElegida || !ubicacion || !tipoVehiculo || enviando) return;

    setEnviando(true);

    try {
      const { id, codigo } = await crearSolicitud({
        categoriaId: categoriaElegida.id,
        descripcion,
        ubicacion: { ...ubicacion, direccion: direccion.trim() },
        vehiculo: { tipo: tipoVehiculo, modelo },
        destino: destino ? { tipo: destino.tipo, id: destino.id } : null,
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

        {destino ? (
          <View
            testID="aviso-destino"
            className="mx-4 mt-2 flex-row items-center gap-2 rounded-campo border border-acento/40 bg-acento/10 px-3 py-2">
            <Ionicons
              name={destino.tipo === 'taller' ? 'storefront-outline' : 'person-outline'}
              size={16}
              color={COLORES.acento}
            />
            <Text className="flex-1 text-mini text-texto">
              {destino.tipo === 'taller' ? 'Se la pedís a un mecánico de ' : 'Se la pedís a '}
              <Text className="font-bold">{destino.nombre || 'este prestador'}</Text>
            </Text>
          </View>
        ) : null}

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
                  ¿Qué vehículo es?
                </Text>
                <Text className="text-chico text-texto-tenue">
                  El mecánico lo ve antes de aceptar, para saber si puede ayudarte.
                </Text>
              </View>

              <View className="flex-row gap-3">
                {TIPOS_VEHICULO.map((tipo) => {
                  const activo = tipoVehiculo === tipo.valor;
                  return (
                    <Pressable
                      key={tipo.valor}
                      testID={`vehiculo-${tipo.valor}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      onPress={() => setTipoVehiculo(tipo.valor)}
                      className={cn(
                        'flex-1 items-center gap-1.5 rounded-tarjeta border py-4',
                        activo ? 'border-acento bg-acento/10' : 'border-borde bg-superficie',
                      )}>
                      <Ionicons name={tipo.icono} size={28} color={activo ? COLORES.acento : COLORES.textoTenue} />
                      <Text className={cn('text-sm font-bold', activo ? 'text-acento' : 'text-texto')}>
                        {tipo.titulo}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <CampoTexto
                testID="campo-modelo"
                etiqueta="Marca y modelo"
                icono="pricetag-outline"
                placeholder={tipoVehiculo === 'moto' ? 'Ej: Honda CB 190R' : 'Ej: Ford Fiesta 2015'}
                value={modelo}
                onChangeText={setModelo}
                maxLength={60}
              />

              <CampoTexto
                testID="campo-descripcion"
                etiqueta="Algo más (opcional)"
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
                  icono={tipoVehiculo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                  titulo="Vehículo"
                  valor={tipoVehiculo ? `${NOMBRE_VEHICULO[tipoVehiculo]} · ${modelo.trim()}` : 'Sin indicar'}
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

              {/* El precio lo pone el mecánico: el cliente lo acepta (y elige cómo pagar) antes de que salga */}
              <Tarjeta testID="tarjeta-precio" className="flex-row items-start gap-3 p-4">
                <Ionicons name="pricetag-outline" size={20} color={COLORES.acento} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-texto">¿Cuánto cuesta?</Text>
                  <Text className="text-mini text-texto-tenue">
                    El mecánico que tome tu solicitud te va a enviar el precio. Recién cuando lo aceptes
                    elegís cómo pagar y el mecánico sale hacia tu ubicación. No se te cobra nada hasta entonces.
                  </Text>
                </View>
              </Tarjeta>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-borde px-4 pb-4 pt-3">
          <Boton
            testID="btn-continuar"
            titulo={esUltimoPaso ? 'Enviar solicitud' : 'Continuar'}
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


