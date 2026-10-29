import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { EstadoSolicitud } from '@/components/solicitud/estado-solicitud';
import { LineaTiempo } from '@/components/solicitud/linea-tiempo';
import {
  Avatar,
  Boton,
  Cargando,
  EncabezadoSeccion,
  ListaVacia,
  Pantalla,
  Tarjeta,
} from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { formatearFechaHora } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { cancelarSolicitud, esCancelable, esEstadoActivo, obtenerSolicitud } from '@/services';
import type { DetalleSolicitud } from '@/types';

/** Seguimiento de una solicitud (RF-VIEW-008). */
export default function DetalleSolicitudScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { datos: solicitud, cargando, error, recargar } = useRecurso<DetalleSolicitud | null>(
    () => obtenerSolicitud(id ?? ''),
    null,
    [id],
  );
  const [cancelando, setCancelando] = useState(false);

  async function cancelar() {
    if (!solicitud) return;
    setCancelando(true);
    try {
      await cancelarSolicitud(solicitud.id);
      recargar();
    } catch (motivo) {
      const mensaje = motivo instanceof Error ? motivo.message : 'Ocurrió un error inesperado.';
      Alert.alert('No se pudo cancelar', mensaje);
    } finally {
      setCancelando(false);
    }
  }

  function confirmarCancelacion() {
    const pregunta = '¿Querés cancelar esta solicitud?';
    if (Platform.OS === 'web') {
      if (window.confirm(pregunta)) void cancelar();
      return;
    }
    Alert.alert('Cancelar solicitud', pregunta, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => void cancelar() },
    ]);
  }

  return (
    <Pantalla>
      <View className="flex-row items-center px-3 pb-2 pt-1">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver a mis solicitudes"
          hitSlop={10}
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-superficie">
          <Ionicons name="chevron-back" size={24} color={COLORES.texto} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-bold text-texto">Detalle de solicitud</Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-5 px-4 pb-10 pt-2">
        {cargando && !solicitud ? (
          <Cargando mensaje="Cargando solicitud…" />
        ) : error ? (
          <View className="gap-2">
            <ListaVacia titulo="No pudimos cargar la solicitud" detalle={error} icono="cloud-offline-outline" />
            <Boton titulo="Reintentar" variante="secundario" icono="refresh" onPress={recargar} />
          </View>
        ) : !solicitud ? (
          <ListaVacia
            titulo="No encontramos esta solicitud"
            detalle="Puede que haya sido eliminada o que no tengas permiso para verla."
            icono="search-outline"
          />
        ) : (
          <>
            <Tarjeta className="gap-3 p-4">
              <View className="gap-0.5">
                <Text className="text-2xl font-extrabold text-texto">{solicitud.categoria_nombre}</Text>
                <Text className="text-chico text-texto-tenue">
                  #{solicitud.codigo} · {formatearFechaHora(solicitud.creado_en)}
                </Text>
              </View>
              <EstadoSolicitud estado={solicitud.estado} grande />
              {solicitud.eta_minutos && esEstadoActivo(solicitud.estado) ? (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={15} color={COLORES.acento} />
                  <Text className="text-sm text-texto">
                    Llegada estimada en <Text className="font-bold text-acento">{solicitud.eta_minutos} min</Text>
                  </Text>
                </View>
              ) : null}
            </Tarjeta>

            <View>
              <EncabezadoSeccion titulo="Seguimiento" />
              <Tarjeta className="p-4">
                <LineaTiempo
                  estado={solicitud.estado}
                  historial={solicitud.historial}
                  creadoEn={solicitud.creado_en}
                />
              </Tarjeta>
            </View>

            <View>
              <EncabezadoSeccion titulo="Mecánico asignado" />
              <TarjetaMecanicoAsignado solicitud={solicitud} />
            </View>

            <View>
              <EncabezadoSeccion titulo="Detalle" />
              <Tarjeta className="gap-4 p-4">
                <FilaDato icono="build-outline" titulo="Problema" valor={solicitud.categoria_nombre} />
                <FilaDato icono="location-outline" titulo="Ubicación" valor={solicitud.ubicacion.direccion} />
                <FilaDato
                  icono="document-text-outline"
                  titulo="Descripción"
                  valor={solicitud.descripcion || 'Sin descripción'}
                />
              </Tarjeta>
            </View>

            {esCancelable(solicitud.estado) ? (
              <Boton
                testID="btn-cancelar-solicitud"
                titulo="Cancelar solicitud"
                variante="peligro"
                icono="close-circle-outline"
                cargando={cancelando}
                deshabilitado={cancelando}
                onPress={confirmarCancelacion}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Pantalla>
  );
}

function TarjetaMecanicoAsignado({ solicitud }: { solicitud: DetalleSolicitud }) {
  const { mecanico } = solicitud;

  if (!mecanico) {
    const mensaje =
      solicitud.estado === 'cancelada'
        ? 'La solicitud se canceló antes de asignar un mecánico.'
        : 'Estamos buscando un mecánico disponible cerca tuyo.';
    return (
      <Tarjeta className="flex-row items-center gap-3 p-4">
        <Ionicons name="search-outline" size={20} color={COLORES.textoTenue} />
        <Text className="flex-1 text-chico text-texto-tenue">{mensaje}</Text>
      </Tarjeta>
    );
  }

  const telefono = mecanico.telefono?.replace(/[^\d+]/g, '') ?? '';
  const abrir = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert('No se pudo abrir', 'No encontramos una aplicación para completar esta acción.'),
    );

  return (
    <Tarjeta className="gap-4 p-4">
      <View className="flex-row items-center gap-3">
        <Avatar uri={mecanico.imagen_url} tamanio={48} icono="construct" />
        <View className="flex-1">
          <Text className="text-base font-bold text-texto" numberOfLines={1}>
            {mecanico.nombre}
          </Text>
          {mecanico.localidad ? (
            <Text className="text-chico text-texto-tenue">{mecanico.localidad}</Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row gap-2">
        <BotonContacto icono="call-outline" etiqueta="Llamar" deshabilitado={!telefono} onPress={() => abrir(`tel:${telefono}`)} />
        <BotonContacto icono="chatbubble-outline" etiqueta="Mensaje" deshabilitado={!telefono} onPress={() => abrir(`sms:${telefono}`)} />
        <BotonContacto
          icono="logo-whatsapp"
          etiqueta="WhatsApp"
          deshabilitado={!telefono}
          onPress={() => abrir(`https://wa.me/${telefono.replace('+', '')}`)}
        />
      </View>
    </Tarjeta>
  );
}

function BotonContacto({
  icono,
  etiqueta,
  deshabilitado,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      disabled={deshabilitado}
      onPress={onPress}
      className={cn(
        'flex-1 items-center gap-1 rounded-campo border border-borde bg-superficie-alta py-3 active:opacity-70',
        deshabilitado && 'opacity-40',
      )}>
      <Ionicons name={icono} size={19} color={COLORES.acento} />
      <Text className="text-mini font-semibold text-texto">{etiqueta}</Text>
    </Pressable>
  );
}

function FilaDato({
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
        <Text className="text-mini font-bold uppercase tracking-wide text-texto-tenue">{titulo}</Text>
        <Text className="text-sm text-texto">{valor}</Text>
      </View>
    </View>
  );
}
