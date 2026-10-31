import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MapaUbicacion } from '@/components/solicitud/mapa-ubicacion';
import { CampoTexto } from '@/components/ui';
import { COLORES } from '@/lib/tema';
import { coordenadasComoTexto, obtenerDireccion, obtenerUbicacionActual } from '@/services';
import type { UbicacionServicio } from '@/types';

type UbicacionTallerProps = {
  ubicacion: UbicacionServicio | null;
  onCambio: (ubicacion: UbicacionServicio) => void;
  /** Avisa cuando el dedo está sobre el mapa, para pausar el scroll del formulario. */
  onInteraccion?: (activa: boolean) => void;
};

/**
 * Ubicación del taller en el registro del mecánico: GPS o pin en el mapa,
 * con la dirección resuelta y editable. Con esto el taller aparece en el mapa.
 */
export function UbicacionTaller({ ubicacion, onCambio, onInteraccion }: UbicacionTallerProps) {
  const [buscando, setBuscando] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Descarta respuestas que llegan después de un movimiento más nuevo. */
  const consultaRef = useRef(0);

  const usarGps = useCallback(async () => {
    const consulta = ++consultaRef.current;
    setBuscando(true);
    setError(null);
    try {
      const actual = await obtenerUbicacionActual();
      if (consulta === consultaRef.current) onCambio(actual);
    } catch (motivo) {
      if (consulta === consultaRef.current) {
        setError(motivo instanceof Error ? motivo.message : 'No pudimos obtener tu ubicación.');
      }
    } finally {
      if (consulta === consultaRef.current) setBuscando(false);
    }
  }, [onCambio]);

  const moverPin = useCallback(
    async (latitud: number, longitud: number) => {
      const consulta = ++consultaRef.current;
      setBuscando(false);
      setError(null);
      onCambio({ latitud, longitud, direccion: coordenadasComoTexto(latitud, longitud) });
      setResolviendo(true);

      const { direccion } = await obtenerDireccion(latitud, longitud);
      if (consulta !== consultaRef.current) return;
      onCambio({ latitud, longitud, direccion });
      setResolviendo(false);
    },
    [onCambio],
  );

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-texto">Ubicación del taller</Text>
        <Pressable
          testID="btn-ubicacion-taller-gps"
          accessibilityRole="button"
          accessibilityLabel="Usar mi ubicación actual como ubicación del taller"
          disabled={buscando}
          onPress={usarGps}
          hitSlop={8}
          className="flex-row items-center gap-1.5 active:opacity-60">
          <Text className="text-mini font-bold text-acento">
            {buscando ? 'Buscando...' : 'Usar mi ubicación'}
          </Text>
          <Ionicons name="locate" size={17} color={COLORES.acento} />
        </Pressable>
      </View>

      <Text className="text-mini text-texto-tenue">
        Tocá el mapa o arrastrá el pin hasta la puerta del taller. Así los clientes te ven en el mapa.
      </Text>

      <MapaUbicacion ubicacion={ubicacion} onMover={moverPin} onInteraccion={onInteraccion} altura={220} />

      {error ? <Text className="text-mini text-peligro">{error}</Text> : null}

      {ubicacion ? (
        <CampoTexto
          testID="campo-direccion-taller"
          etiqueta="Dirección del taller"
          icono="location-outline"
          placeholder="Calle y número"
          value={ubicacion.direccion}
          onChangeText={(direccion) => onCambio({ ...ubicacion, direccion })}
        />
      ) : null}

      {resolviendo ? (
        <Text className="text-mini text-texto-tenue">Buscando la dirección del punto marcado...</Text>
      ) : null}
    </View>
  );
}
