import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { DistintivoEstado } from '@/components/seguimiento/distintivo-estado';
import { LineaTiempo } from '@/components/seguimiento/linea-tiempo';
import { ResumenPago } from '@/components/seguimiento/resumen-pago';
import { Boton, CampoTexto, Cargando, Chip, EstadoError, ListaVacia, Pantalla, Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { formatearMoneda } from '@/lib/formato';
import {
  cambiarEstadoSolicitud,
  cancelarSolicitud,
  esCancelable,
  netoMecanico,
  NOMBRE_MEDIO,
  obtenerMecanicoIdActual,
  obtenerSolicitud,
  obtenerUsuarioId,
  siguienteEstadoMecanico,
  suscribirseASolicitudes,
} from '@/services';
import type { EstadoServicio, Servicio } from '@/types';

/**
 * Texto del botón con el que el mecánico registra cada etapa. La base agrupa pasos:
 * aceptar ya deja la solicitud en camino, y llegar ya inicia el trabajo.
 */
const ACCION_MECANICO: Partial<Record<EstadoServicio, string>> = {
  aceptado: 'Aceptar y salir en camino',
  en_camino: 'Salir en camino',
  llegue: 'Llegué, empezar el trabajo',
  trabajando: 'Iniciar trabajo',
  finalizado: 'Finalizar trabajo',
};

const MOTIVOS_CLIENTE = [
  'Ya lo resolví',
  'Conseguí otra ayuda',
  'La espera es muy larga',
  'La pedí por error',
];

const MOTIVOS_MECANICO = [
  'No puedo llegar a la ubicación',
  'Requiere grúa o taller',
  'El cliente no responde',
  'No tengo los repuestos',
];

const MINUTOS_ETA = [10, 20, 30, 45];

type Detalle = { servicio: Servicio | null; usuarioId: string; mecanicoId: string | null };

async function cargarDetalle(id: string): Promise<Detalle> {
  const [servicio, usuarioId, mecanicoId] = await Promise.all([
    obtenerSolicitud(id),
    obtenerUsuarioId(),
    obtenerMecanicoIdActual(),
  ]);
  return { servicio, usuarioId, mecanicoId };
}

/** Seguimiento de una solicitud: estado en vivo, historial y acciones (REQ-05). */
export default function SeguimientoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const detalle = useRecurso<Detalle | null>(() => cargarDetalle(id), null, [id]);
  const { recargar } = detalle;

  // Cambios en vivo: el cliente ve cuándo el mecánico acepta, sale y llega.
  useEffect(() => suscribirseASolicitudes(recargar, id), [id, recargar]);

  const [observacion, setObservacion] = useState('');
  const [eta, setEta] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const servicio = detalle.datos?.servicio ?? null;
  const mecanicoId = detalle.datos?.mecanicoId ?? null;

  const esCliente = !!servicio && servicio.cliente_id === detalle.datos?.usuarioId;
  const esAsignado = !!servicio && !!mecanicoId && servicio.mecanico_id === mecanicoId;
  const puedeAceptar =
    !!servicio && !!mecanicoId && servicio.estado === 'pendiente' && !servicio.mecanico_id;

  const proximo: EstadoServicio | null = !servicio
    ? null
    : puedeAceptar
      ? 'aceptado'
      : esAsignado
        ? siguienteEstadoMecanico(servicio.estado)
        : null;

  const puedeCancelar = !!servicio && esCancelable(servicio.estado) && (esCliente || esAsignado);
  const motivoObligatorio = !!servicio?.mecanico_id;
  const motivos = esAsignado ? MOTIVOS_MECANICO : MOTIVOS_CLIENTE;

  const ejecutar = async (accion: () => Promise<void>, alTerminar: () => void) => {
    if (enviando) return;
    setEnviando(true);
    try {
      await accion();
      alTerminar();
      recargar();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const avanzarEstado = () => {
    if (!servicio || !proximo) return;
    void ejecutar(
      () =>
        cambiarEstadoSolicitud(servicio.id, proximo, {
          observacion,
          etaMinutos: proximo === 'aceptado' || proximo === 'en_camino' ? eta : null,
        }),
      () => {
        setObservacion('');
        setEta(null);
      },
    );
  };

  const confirmarCancelacion = () => {
    if (!servicio) return;
    if (motivoObligatorio && !motivo.trim()) {
      Alert.alert('Falta el motivo', 'Indicá por qué cancelás la solicitud.');
      return;
    }
    void ejecutar(
      () => cancelarSolicitud(servicio.id, motivo),
      () => {
        setCancelando(false);
        setMotivo('');
      },
    );
  };

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-3 pb-2 pt-1">
          <Pressable
            testID="btn-volver"
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={10}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/solicitudes'))}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full active:opacity-60">
            <Ionicons name="arrow-back" size={23} color="#F9FAFB" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-texto">Seguimiento</Text>
            {servicio ? (
              <Text className="text-mini text-texto-tenue">{servicio.codigo}</Text>
            ) : null}
          </View>
        </View>

        {detalle.cargando && !detalle.datos ? (
          <Cargando mensaje="Cargando la solicitud..." />
        ) : detalle.error && !detalle.datos ? (
          <EstadoError
            titulo="No pudimos cargar la solicitud"
            mensaje={detalle.error}
            icono="cloud-offline-outline"
            onReintentar={recargar}
          />
        ) : !servicio ? (
          <ListaVacia
            titulo="Solicitud no encontrada"
            detalle="Puede que no exista o que no tengas permiso para verla."
            icono="search-outline"
          />
        ) : (
          <ScrollView
            contentContainerClassName="gap-4 px-4 pb-8 pt-2"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={detalle.cargando} onRefresh={recargar} tintColor="#FFC107" />
            }>
            {/* Estado actual */}
            <Tarjeta className="gap-3 p-4">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-xl font-extrabold text-texto">
                  {servicio.categoria_nombre}
                </Text>
                <DistintivoEstado estado={servicio.estado} />
              </View>

              {servicio.estado === 'en_camino' && servicio.eta_minutos ? (
                <Text testID="texto-eta" className="text-sm font-bold text-exito">
                  Llega en aproximadamente {servicio.eta_minutos} min
                </Text>
              ) : null}

              {servicio.mecanico ? (
                <View className="flex-row items-center gap-3 rounded-campo bg-superficie-alta p-3">
                  <Ionicons name="construct-outline" size={20} color="#FFC107" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-texto">
                      {servicio.mecanico.nombre ?? 'Mecánico asignado'}
                    </Text>
                    {servicio.mecanico.telefono ? (
                      <Text className="text-mini text-texto-tenue">{servicio.mecanico.telefono}</Text>
                    ) : null}
                  </View>
                  {servicio.mecanico.telefono && esCliente ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Llamar al mecánico"
                      hitSlop={8}
                      onPress={() => Linking.openURL(`tel:${servicio.mecanico?.telefono}`)}
                      className="h-9 w-9 items-center justify-center rounded-full bg-acento active:bg-acento-oscuro">
                      <Ionicons name="call" size={17} color="#0B0B0D" />
                    </Pressable>
                  ) : null}
                </View>
              ) : servicio.estado === 'pendiente' ? (
                <Text className="text-chico text-texto-tenue">
                  Estamos esperando que un mecánico acepte tu solicitud.
                </Text>
              ) : null}

              <View className="gap-1">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={15} color="#9CA3AF" />
                  <Text className="flex-1 text-sm text-texto">{servicio.ubicacion.direccion}</Text>
                </View>
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    Linking.openURL(
                      `https://www.openstreetmap.org/?mlat=${servicio.ubicacion.latitud}&mlon=${servicio.ubicacion.longitud}#map=17/${servicio.ubicacion.latitud}/${servicio.ubicacion.longitud}`,
                    )
                  }
                  className="active:opacity-60">
                  <Text className="text-mini font-semibold text-acento">
                    Ver en el mapa ({servicio.ubicacion.latitud.toFixed(5)}, {servicio.ubicacion.longitud.toFixed(5)})
                  </Text>
                </Pressable>
              </View>

              {servicio.descripcion ? (
                <Text className="text-chico text-texto-tenue">{servicio.descripcion}</Text>
              ) : null}
            </Tarjeta>

            {/* Precio y cobro (RF-QUOTE-002, RF-PAY-003): lo ven el cliente y el mecánico asignado */}
            {esCliente || esAsignado ? (
              <ResumenPago servicio={servicio} esAsignado={esAsignado} />
            ) : null}

            {servicio.estado === 'cancelada' ? (
              <Tarjeta testID="tarjeta-cancelacion" className="gap-1 border-peligro/40 p-4">
                <Text className="text-sm font-bold text-peligro">
                  Cancelada por {servicio.cancelado_por === 'mecanico' ? 'el mecánico' : 'el cliente'}
                </Text>
                <Text className="text-chico text-texto">
                  {servicio.motivo_cancelacion ?? 'Sin motivo indicado'}
                </Text>
              </Tarjeta>
            ) : null}

            {/* Acciones del mecánico */}
            {proximo ? (
              <Tarjeta className="gap-3 p-4">
                <Text className="text-sm font-bold text-texto">
                  {proximo === 'aceptado' ? 'Nueva solicitud disponible' : 'Actualizá el servicio'}
                </Text>

                {proximo === 'aceptado' || proximo === 'en_camino' ? (
                  <View className="gap-2">
                    <Text className="text-mini text-texto-tenue">Tiempo estimado de llegada</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {MINUTOS_ETA.map((minutos) => (
                        <Chip
                          key={minutos}
                          texto={`${minutos} min`}
                          activo={eta === minutos}
                          onPress={() => setEta(eta === minutos ? null : minutos)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Antes de aceptar: cuánto paga el cliente y cuánto recibe el mecánico */}
                {proximo === 'aceptado' && servicio.monto_final != null ? (
                  <View testID="precio-disponible" className="gap-0.5 rounded-campo bg-superficie-alta p-3">
                    <Text className="text-sm font-bold text-texto">
                      El cliente paga {formatearMoneda(servicio.monto_final)}
                    </Text>
                    <Text className="text-mini text-texto-tenue">
                      Vos recibís {formatearMoneda(netoMecanico(servicio.monto_final))} (90 %) ·{' '}
                      {NOMBRE_MEDIO[servicio.medio_pago]}
                    </Text>
                  </View>
                ) : null}

                <CampoTexto
                  testID="campo-observacion"
                  placeholder={
                    proximo === 'finalizado'
                      ? 'Trabajo realizado (opcional)'
                      : 'Observación (opcional)'
                  }
                  value={observacion}
                  onChangeText={setObservacion}
                  maxLength={200}
                />

                <Boton
                  testID={`btn-estado-${proximo}`}
                  titulo={ACCION_MECANICO[proximo] ?? 'Continuar'}
                  iconoDerecha="arrow-forward"
                  cargando={enviando}
                  deshabilitado={enviando}
                  onPress={avanzarEstado}
                />
              </Tarjeta>
            ) : null}

            {/* Cancelación */}
            {puedeCancelar ? (
              cancelando ? (
                <Tarjeta testID="panel-cancelacion" className="gap-3 border-peligro/40 p-4">
                  <Text className="text-sm font-bold text-texto">¿Por qué cancelás?</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {motivos.map((m) => (
                      <Chip key={m} texto={m} activo={motivo === m} onPress={() => setMotivo(m)} />
                    ))}
                  </View>
                  <CampoTexto
                    testID="campo-motivo"
                    placeholder={motivoObligatorio ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}
                    value={motivo}
                    onChangeText={setMotivo}
                    maxLength={200}
                  />
                  <View className="flex-row gap-3">
                    <Boton
                      titulo="Volver"
                      variante="secundario"
                      className="flex-1"
                      onPress={() => setCancelando(false)}
                    />
                    <Boton
                      testID="btn-confirmar-cancelacion"
                      titulo="Cancelar"
                      variante="peligro"
                      className="flex-1"
                      cargando={enviando}
                      deshabilitado={enviando}
                      onPress={confirmarCancelacion}
                    />
                  </View>
                </Tarjeta>
              ) : (
                <Boton
                  testID="btn-cancelar-solicitud"
                  titulo="Cancelar solicitud"
                  variante="peligro"
                  icono="close-circle-outline"
                  onPress={() => setCancelando(true)}
                />
              )
            ) : null}

            {/* Historial */}
            <Tarjeta className="gap-3 p-4">
              <Text className="text-sm font-bold text-texto">Historial</Text>
              <LineaTiempo servicio={servicio} />
            </Tarjeta>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Pantalla>
  );
}
