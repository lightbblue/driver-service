import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { IndicadorPasos } from '@/components/solicitud/indicador-pasos';
import { MapaEstatico } from '@/components/solicitud/mapa-estatico';
import { SelectorCategoria } from '@/components/solicitud/selector-categoria';
import { Boton, CampoTexto, Cargando, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { listarCategoriasAveria, obtenerUbicacionActual } from '@/services';
import type { CategoriaAveria, PasoSolicitud, UbicacionServicio } from '@/types';

const PASOS: PasoSolicitud[] = [
  { numero: 1, titulo: 'Problema' },
  { numero: 2, titulo: 'Ubicación' },
  { numero: 3, titulo: 'Detalles' },
  { numero: 4, titulo: 'Confirmar' },
];

const MAX_DESCRIPCION = 200;

/**
 * Flujo de Solicitar asistencia (RF-VIEW-006).
 *
 * Los cuatro pasos viven en una sola pantalla con el estado en memoria: así ir
 * y volver conserva lo seleccionado y lo escrito, que es uno de los criterios.
 *
 * El avance NO está condicionado por el contenido: la validación por paso, la
 * obtención real de la ubicación y el registro de la solicitud son E2/E3
 * (RF-ASSIST-001 a 005).
 */
export default function NuevaSolicitudScreen() {
  const router = useRouter();

  const categorias = useRecurso<CategoriaAveria[]>(listarCategoriasAveria, []);
  const ubicacion = useRecurso<UbicacionServicio | null>(obtenerUbicacionActual, null);

  const [paso, setPaso] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');

  const categoriaElegida = categorias.datos.find((c) => c.codigo === categoria) ?? null;
  const esUltimoPaso = paso === PASOS.length;

  const retroceder = () => {
    if (paso > 1) setPaso(paso - 1);
    else router.back();
  };

  const avanzar = () => {
    if (esUltimoPaso) router.replace('/solicitud/confirmada');
    else setPaso(paso + 1);
  };

  return (
    <Pantalla>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-3 pb-2 pt-1">
          <Pressable
            testID="btn-retroceder"
            accessibilityRole="button"
            accessibilityLabel="Volver al paso anterior"
            hitSlop={10}
            onPress={retroceder}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-superficie">
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text className="flex-1 text-center text-lg font-bold text-texto">
            Solicitar asistencia
          </Text>

          <Pressable
            testID="btn-ayuda"
            accessibilityRole="button"
            accessibilityLabel="Ayuda"
            hitSlop={10}
            className="min-h-[40px] flex-row items-center gap-1.5 rounded-full px-2 active:bg-superficie">
            <Text className="text-chico font-semibold text-acento">Ayuda</Text>
            <Ionicons name="help-circle-outline" size={20} color="#FFC107" />
          </Pressable>
        </View>

        <IndicadorPasos pasos={PASOS} pasoActual={paso} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 px-4 pb-6">
          {paso === 1 ? (
            <View className="gap-3">
              <View>
                <Text className="text-xl font-extrabold text-texto">¿Qué problema tenés?</Text>
                <Text className="text-chico text-texto-tenue">
                  Seleccioná el tipo de asistencia que necesitás
                </Text>
              </View>

              {categorias.cargando ? (
                <Cargando mensaje="Cargando categorías…" />
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
                  <Text className="text-xl font-extrabold text-texto">Tu ubicación</Text>
                  <Text className="text-chico text-texto-tenue">
                    Verificá que tu ubicación sea correcta
                  </Text>
                </View>
                <Pressable
                  testID="btn-usar-ubicacion"
                  accessibilityRole="button"
                  accessibilityLabel="Usar mi ubicación actual"
                  hitSlop={8}
                  className="flex-row items-center gap-1.5 active:opacity-60">
                  <Text className="text-mini font-bold text-acento">Usar mi ubicación actual</Text>
                  <Ionicons name="locate" size={17} color="#FFC107" />
                </Pressable>
              </View>

              <MapaEstatico />

              {ubicacion.cargando ? (
                <Cargando mensaje="" />
              ) : (
                <Tarjeta className="flex-row items-center gap-3 p-3">
                  <Ionicons name="location" size={19} color="#FFC107" />
                  <Text className="flex-1 text-chico text-texto" numberOfLines={2}>
                    {ubicacion.datos?.direccion ?? 'Sin dirección disponible'}
                  </Text>
                  <Pressable
                    testID="btn-editar-direccion"
                    accessibilityRole="button"
                    accessibilityLabel="Editar dirección"
                    className="rounded-full bg-superficie-alta px-3 py-1.5 active:opacity-70">
                    <Text className="text-mini font-semibold text-texto">Editar</Text>
                  </Pressable>
                </Tarjeta>
              )}
            </View>
          ) : null}

          {paso === 3 ? (
            <View className="gap-3">
              <View>
                <Text className="text-xl font-extrabold text-texto">¿Necesitás algo más?</Text>
                <Text className="text-chico text-texto-tenue">
                  Podés agregar información adicional (opcional)
                </Text>
              </View>

              <CampoTexto
                testID="campo-descripcion"
                placeholder="Ej: La moto no enciende, escucho un ruido raro, etc."
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
                <Text className="text-xl font-extrabold text-texto">Confirmá tu solicitud</Text>
                <Text className="text-chico text-texto-tenue">
                  Revisá los datos antes de enviarla
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
                  valor={ubicacion.datos?.direccion ?? 'Sin dirección disponible'}
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
