import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { SelectorEspecialidades } from '@/components/registro/selector-especialidades';
import { UbicacionTaller } from '@/components/registro/ubicacion-taller';
import { GaleriaMiTaller } from '@/components/taller/galeria-mi-taller';
import { Avatar, Boton, CampoTexto, Cargando, EstadoError, ListaVacia, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';
import {
  actualizarMiTaller,
  listarMiembrosTaller,
  obtenerMiTaller,
  quitarMiembroTaller,
  responderUnionTaller,
  subirFotoTaller,
} from '@/services';
import type { MiembroTaller, MiTaller, UbicacionServicio } from '@/types';

type Datos = { taller: MiTaller | null; miembros: MiembroTaller[] };

async function cargar(): Promise<Datos> {
  const taller = await obtenerMiTaller();
  // Quien todavía espera que lo acepten no ve a los miembros.
  const miembros = taller && taller.rol !== 'pendiente' ? await listarMiembrosTaller() : [];
  return { taller, miembros };
}

const ETIQUETA_ESTADO: Record<MiembroTaller['estado'], string> = {
  dueno: 'Dueño',
  miembro: 'Mecánico',
  pendiente: 'Quiere sumarse',
};

/** Mi taller: el dueño edita los datos, la foto y los miembros; el resto los consulta. */
export default function MiTallerScreen() {
  const router = useRouter();
  const recurso = useRecurso<Datos | null>(cargar, null);
  const { recargar } = recurso;
  const taller = recurso.datos?.taller ?? null;
  const miembros = recurso.datos?.miembros ?? [];
  const esDueno = taller?.rol === 'dueno';

  // Lo que el dueño va cambiando; null = sin tocar (se muestra lo guardado).
  const [nombre, setNombre] = useState<string | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [localidad, setLocalidad] = useState<string | null>(null);
  const [especialidades, setEspecialidades] = useState<string[] | null>(null);
  const [descripcion, setDescripcion] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<UbicacionServicio | null>(null);
  const [foto, setFoto] = useState<{ base64: string; mimeType?: string | null; uri: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mapaActivo, setMapaActivo] = useState(false);

  const valor = {
    nombre: nombre ?? taller?.nombre ?? '',
    telefono: telefono ?? taller?.telefono ?? '',
    localidad: localidad ?? taller?.localidad ?? '',
    especialidades: especialidades ?? taller?.especialidades ?? [],
    descripcion: descripcion ?? taller?.descripcion ?? '',
    ubicacion:
      ubicacion ??
      (taller ? { latitud: taller.latitud, longitud: taller.longitud, direccion: taller.direccion } : null),
  };

  const elegirFoto = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    const imagen = resultado.canceled ? null : resultado.assets[0];
    if (imagen?.base64) setFoto({ base64: imagen.base64, mimeType: imagen.mimeType, uri: imagen.uri });
  };

  const guardar = async () => {
    if (guardando || !valor.ubicacion) return;
    if (!valor.nombre.trim()) {
      Alert.alert('Falta el nombre', 'Indicá el nombre del taller.');
      return;
    }
    setGuardando(true);
    try {
      const imagenUrl = foto ? await subirFotoTaller(foto.base64, foto.mimeType) : null;
      await actualizarMiTaller({
        nombre: valor.nombre,
        telefono: valor.telefono,
        localidad: valor.localidad,
        descripcion: valor.descripcion,
        especialidades: valor.especialidades,
        ubicacion: valor.ubicacion,
        imagenUrl,
      });
      setFoto(null);
      Alert.alert('Taller actualizado', 'Los cambios ya se ven en el mapa.');
      recargar();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const ejecutar = async (id: string, accion: () => Promise<void>) => {
    setOcupado(id);
    try {
      await accion();
      recargar();
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setOcupado(null);
    }
  };

  const confirmarQuitar = (miembro: MiembroTaller) =>
    Alert.alert('Quitar del taller', `${miembro.nombre} va a dejar de recibir los pedidos del taller.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => void ejecutar(miembro.mecanico_id, () => quitarMiembroTaller(miembro.mecanico_id)),
      },
    ]);

  const pendientes = miembros.filter((m) => m.estado === 'pendiente');
  const equipo = miembros.filter((m) => m.estado !== 'pendiente');

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <View className="flex-row items-center px-3 pb-2 pt-1">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full active:opacity-60">
          <Ionicons name="arrow-back" size={23} color={COLORES.texto} />
        </Pressable>
        <Text className="text-lg font-extrabold text-texto">Mi taller</Text>
      </View>

      {recurso.cargando && !recurso.datos ? (
        <Cargando mensaje="Cargando tu taller..." />
      ) : recurso.error && !recurso.datos ? (
        <EstadoError titulo="No pudimos cargar tu taller" mensaje={recurso.error} onReintentar={recargar} />
      ) : !taller ? (
        <ListaVacia
          titulo="No pertenecés a ningún taller"
          detalle="Trabajás en ruta: recibís los pedidos de tu zona y vas hasta donde está el cliente."
          icono="car-outline"
        />
      ) : (
        <ScrollView
          scrollEnabled={!mapaActivo}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 px-4 pb-10 pt-2">
          {/* Encabezado con la foto */}
          <View className="items-center gap-2">
            <View>
              <View className="rounded-full border-2 border-acento p-0.5">
                <Avatar uri={foto?.uri ?? taller.imagen_url} tamanio={96} icono="storefront" />
              </View>
              {esDueno ? (
                <Pressable
                  testID="btn-foto-taller"
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar la foto del taller"
                  onPress={() => void elegirFoto()}
                  className="absolute -bottom-1 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-fondo bg-superficie-alta active:bg-superficie">
                  <Ionicons name="camera" size={16} color={COLORES.texto} />
                </Pressable>
              ) : null}
            </View>
            <Text className="text-xl font-extrabold text-texto">{taller.nombre}</Text>
            <Text className="text-mini text-texto-tenue">
              {taller.rol === 'dueno' ? 'Sos el dueño' : taller.rol === 'miembro' ? 'Sos mecánico del taller' : 'Pedido pendiente'}
            </Text>
          </View>

          {taller.rol === 'pendiente' ? (
            <Tarjeta testID="aviso-pendiente" className="flex-row items-start gap-3 border-acento/40 p-4">
              <Ionicons name="time-outline" size={20} color={COLORES.acento} />
              <Text className="flex-1 text-chico text-texto">
                Le pediste al dueño de {taller.nombre} sumarte. Mientras tanto trabajás en ruta; te avisamos cuando responda.
              </Text>
            </Tarjeta>
          ) : null}

          {/* Datos del taller: el dueño los edita, el resto los ve */}
          {esDueno ? (
            <Tarjeta className="gap-3 p-4">
              <Text className="text-sm font-bold text-texto">Datos del taller</Text>
              <CampoTexto testID="campo-nombre-taller" etiqueta="Nombre" icono="storefront-outline" value={valor.nombre} onChangeText={setNombre} maxLength={80} />
              <CampoTexto testID="campo-telefono-taller" etiqueta="Teléfono" icono="call-outline" keyboardType="phone-pad" value={valor.telefono} onChangeText={setTelefono} maxLength={30} />
              <CampoTexto testID="campo-localidad-taller" etiqueta="Localidad" icono="navigate-outline" value={valor.localidad} onChangeText={setLocalidad} maxLength={60} />
              <SelectorEspecialidades valor={valor.especialidades} onCambio={setEspecialidades} />
              <CampoTexto testID="campo-descripcion-taller" etiqueta="Descripción y horarios" icono="document-text-outline" multiline value={valor.descripcion} onChangeText={setDescripcion} maxLength={300} />
              <UbicacionTaller ubicacion={valor.ubicacion} onCambio={setUbicacion} onInteraccion={setMapaActivo} />
              <Boton testID="btn-guardar-taller" titulo="Guardar cambios" icono="save-outline" cargando={guardando} deshabilitado={guardando} onPress={() => void guardar()} />
            </Tarjeta>
          ) : (
            <Tarjeta className="gap-2 p-4">
              <Fila icono="location-outline" texto={taller.direccion} />
              {taller.telefono ? <Fila icono="call-outline" texto={taller.telefono} /> : null}
              {taller.especialidades.length > 0 ? <Fila icono="build-outline" texto={taller.especialidades.join(' · ')} /> : null}
              {taller.descripcion ? <Fila icono="document-text-outline" texto={taller.descripcion} /> : null}
            </Tarjeta>
          )}

          {/* Galería: la ven los clientes en el detalle del taller */}
          {taller.rol !== 'pendiente' ? <GaleriaMiTaller tallerId={taller.id} esDueno={esDueno} /> : null}

          {/* Pedidos para sumarse (solo el dueño) */}
          {esDueno && pendientes.length > 0 ? (
            <Tarjeta testID="pedidos-union" className="gap-3 border-acento/40 p-4">
              <Text className="text-sm font-bold text-texto">Quieren sumarse ({pendientes.length})</Text>
              {pendientes.map((m) => (
                <View key={m.mecanico_id} className="gap-2">
                  <FilaMiembro miembro={m} />
                  <View className="flex-row gap-2">
                    <Boton
                      titulo="Rechazar"
                      variante="secundario"
                      className="flex-1"
                      deshabilitado={!!ocupado}
                      onPress={() => void ejecutar(m.mecanico_id, () => responderUnionTaller(m.mecanico_id, false))}
                    />
                    <Boton
                      testID={`btn-aceptar-${m.mecanico_id}`}
                      titulo="Aceptar"
                      className="flex-1"
                      cargando={ocupado === m.mecanico_id}
                      deshabilitado={!!ocupado}
                      onPress={() => void ejecutar(m.mecanico_id, () => responderUnionTaller(m.mecanico_id, true))}
                    />
                  </View>
                </View>
              ))}
            </Tarjeta>
          ) : null}

          {/* Equipo */}
          {taller.rol !== 'pendiente' ? (
            <Tarjeta className="gap-3 p-4">
              <Text className="text-sm font-bold text-texto">Mecánicos ({equipo.length})</Text>
              {equipo.map((m) => (
                <View key={m.mecanico_id} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <FilaMiembro miembro={m} />
                  </View>
                  {esDueno && m.estado === 'miembro' ? (
                    ocupado === m.mecanico_id ? (
                      <ActivityIndicator color={COLORES.peligro} />
                    ) : (
                      <Pressable
                        testID={`btn-quitar-${m.mecanico_id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar a ${m.nombre} del taller`}
                        hitSlop={8}
                        onPress={() => confirmarQuitar(m)}>
                        <Text className="text-chico font-bold text-peligro">Quitar</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ))}
              {esDueno ? (
                <Text className="text-mini text-texto-tenue">
                  Para sumar mecánicos, que se registren con &quot;Me sumo&quot; y elijan tu taller: te llega el pedido acá.
                </Text>
              ) : null}
            </Tarjeta>
          ) : null}
        </ScrollView>
      )}
    </Pantalla>
  );
}

function Fila({ icono, texto }: { icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name={icono} size={16} color={COLORES.textoTenue} />
      <Text className="flex-1 text-chico text-texto">{texto}</Text>
    </View>
  );
}

function FilaMiembro({ miembro }: { miembro: MiembroTaller }) {
  return (
    <View testID={`miembro-${miembro.mecanico_id}`} className="flex-row items-center gap-3">
      <Avatar uri={miembro.avatar_url} tamanio={40} />
      <View className="flex-1">
        <Text className="text-sm font-bold text-texto">{miembro.nombre}</Text>
        <Text className="text-mini text-texto-tenue">{miembro.telefono ?? 'Sin teléfono'}</Text>
      </View>
      <View
        className={cn(
          'rounded-full px-2 py-0.5',
          miembro.estado === 'dueno' ? 'bg-acento/15' : miembro.estado === 'pendiente' ? 'bg-info/15' : 'bg-superficie-alta',
        )}>
        <Text
          className={cn(
            'text-mini font-bold',
            miembro.estado === 'dueno' ? 'text-acento' : miembro.estado === 'pendiente' ? 'text-info' : 'text-texto-tenue',
          )}>
          {ETIQUETA_ESTADO[miembro.estado]}
        </Text>
      </View>
    </View>
  );
}
