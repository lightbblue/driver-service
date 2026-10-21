
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { IndicadorPasos } from '@/components/solicitud/indicador-pasos';
import { MapaEstatico } from '@/components/solicitud/mapa-estatico';
import { SelectorCategoria } from '@/components/solicitud/selector-categoria';
import { Boton, CampoTexto, Cargando, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import {
  crearSolicitud,
  listarCategoriasAveria,
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
  const ubicacion = useRecurso<UbicacionServicio | null>(obtenerUbicacionActual, null);

  const [paso, setPaso] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [direccionEditada, setDireccionEditada] = useState<string | null>(null);
  const [actualizandoUbicacion, setActualizandoUbicacion] = useState(false);


  const categoriaElegida =
    categorias.datos.find((c) => c.codigo === categoria) ?? null;

  const esUltimoPaso = paso === PASOS.length;

  const direccionActual =
    direccionEditada ?? ubicacion.datos?.direccion ?? '';

  const retroceder = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    } else {
      router.back();
    }
  };

  const actualizarUbicacion = async () => {
    if (actualizandoUbicacion) return;

    setActualizandoUbicacion(true);

    try {
      const nuevaUbicacion = await obtenerUbicacionActual();
      ubicacion.recargar();
      setDireccionEditada(nuevaUbicacion.direccion);
    } catch (error) {
      Alert.alert(
        'No se pudo obtener la ubicación',
        error instanceof Error
          ? error.message
          : 'Verificá los permisos de ubicación.',
      );
    } finally {
      setActualizandoUbicacion(false);
    }
  };

  const avanzar = async () => {
    console.log('[SOLICITUD] Se pulsó continuar/confirmar', {
  paso,
  esUltimoPaso,
  categoria,
  tieneUbicacion: !!ubicacion.datos,
  direccion: direccionActual,
});
    if (!esUltimoPaso) {
      if (paso === 1 && !categoriaElegida) {
        Alert.alert(
          'Falta elegir un problema',
          'Seleccioná el tipo de asistencia.',
        );
        return;
      }

      if (paso === 2 && !ubicacion.datos) {
        Alert.alert(
          'Ubicación no disponible',
          'Usá el botón de ubicación actual e intentá nuevamente.',
        );
        return;
      }

      setPaso(paso + 1);
      return;
    }

    if (!categoriaElegida) {
      Alert.alert('Falta elegir un problema', 'Seleccioná el tipo de asistencia.');
      return;
    }

    if (!ubicacion.datos || !direccionActual.trim()) {
      Alert.alert(
        'Ubicación no disponible',
        'Obtené tu ubicación o ingresá una dirección.',
      );
      return;
    }

    if (enviando) return;

    setEnviando(true);

    try {
      await crearSolicitud({
        categoriaId: categoriaElegida.id,
        descripcion,
        ubicacion: {
          ...ubicacion.datos,
          direccion: direccionActual.trim(),
        },
      });

      router.replace('/solicitud/confirmada');
    } catch (error) {
      Alert.alert(
        'No se pudo enviar la solicitud',
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado.',
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
            <Ionicons name="arrow-back" size={23} color="#F9FAFB" />
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
                    Verificá la dirección donde necesitás asistencia.
                  </Text>
                </View>

                <Pressable
                  testID="btn-usar-ubicacion"
                  accessibilityRole="button"
                  accessibilityLabel="Usar mi ubicación actual"
                  disabled={actualizandoUbicacion}
                  onPress={actualizarUbicacion}
                  className="flex-row items-center gap-1.5 active:opacity-60"
                >
                  <Text className="text-mini font-bold text-acento">
                    {actualizandoUbicacion ? 'Buscando...' : 'Usar mi ubicación'}
                  </Text>
                  <Ionicons name="locate" size={17} color="#FFC107" />
                </Pressable>
              </View>

              <MapaEstatico etiqueta="Vista ilustrativa de ubicación" />

              {ubicacion.cargando && !ubicacion.datos ? (
                <Cargando mensaje="Obteniendo ubicación..." />
              ) : (
                <Tarjeta className="gap-3 p-3">
                  <CampoTexto
                    testID="campo-direccion"
                    etiqueta="Dirección de asistencia"
                    placeholder="Ingresá la dirección"
                    icono="location-outline"
                    value={direccionActual}
                    onChangeText={setDireccionEditada}
                    accessibilityLabel="Dirección de asistencia"
                  />

                  <Text className="text-mini text-texto-tenue">
                    Podés corregir la dirección antes de continuar. Para actualizar
                    las coordenadas, usá el botón de ubicación actual.
                  </Text>

                  {ubicacion.datos ? (
                    <Text className="text-mini text-texto-tenue">
                      Coordenadas GPS: {ubicacion.datos.latitud.toFixed(5)},{' '}
                      {ubicacion.datos.longitud.toFixed(5)}
                    </Text>
                  ) : (
                    <Text className="text-mini text-texto-tenue">
                      Todavía no tenemos coordenadas GPS. Permití el acceso a la
                      ubicación e intentá nuevamente.
                    </Text>
                  )}
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
                  valor={direccionActual || 'Sin dirección disponible'}
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
      <Ionicons name={icono} size={19} color="#9CA3AF" />
      <View className="flex-1">
        <Text className="text-mini font-bold uppercase tracking-wide text-texto-tenue">
          {titulo}
        </Text>
        <Text className="text-sm text-texto">{valor}</Text>
      </View>
    </View>
  );
}


