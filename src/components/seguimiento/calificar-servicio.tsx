import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Boton, CampoTexto, Tarjeta } from '@/components/ui';
import { COLORES } from '@/lib/tema';
import { calificarServicio } from '@/services';
import type { Servicio } from '@/types';

const ESTRELLAS = [1, 2, 3, 4, 5];
const TEXTO_PUNTAJE = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

type CalificarServicioProps = {
  servicio: Servicio;
  esCliente: boolean;
  onCalificado: () => void;
};

function Estrellas({ puntaje, tamanio, onElegir }: { puntaje: number; tamanio: number; onElegir?: (n: number) => void }) {
  return (
    <View className="flex-row gap-1.5">
      {ESTRELLAS.map((n) => (
        <Pressable
          key={n}
          testID={`estrella-${n}`}
          disabled={!onElegir}
          accessibilityRole={onElegir ? 'button' : undefined}
          accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          hitSlop={4}
          onPress={() => onElegir?.(n)}>
          <Ionicons
            name={n <= puntaje ? 'star' : 'star-outline'}
            size={tamanio}
            color={n <= puntaje ? COLORES.acento : COLORES.textoSutil}
          />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Calificación de un servicio finalizado (RF-RATING-001, RN-011).
 * El cliente elige de 1 a 5 estrellas una sola vez; después, él y el mecánico la ven.
 */
export function CalificarServicio({ servicio, esCliente, onCalificado }: CalificarServicioProps) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const calificacion = servicio.calificacion;

  if (calificacion) {
    return (
      <Tarjeta testID="tarjeta-calificacion" className="gap-2 p-4">
        <Text className="text-sm font-bold text-texto">
          {esCliente ? 'Tu calificación' : 'Calificación del cliente'}
        </Text>
        <View className="flex-row items-center gap-3">
          <Estrellas puntaje={calificacion.puntaje} tamanio={22} />
          <Text className="text-chico text-texto-tenue">{TEXTO_PUNTAJE[calificacion.puntaje]}</Text>
        </View>
        {calificacion.comentario ? (
          <Text className="text-chico text-texto">“{calificacion.comentario}”</Text>
        ) : null}
      </Tarjeta>
    );
  }

  if (!esCliente) {
    return (
      <Tarjeta testID="tarjeta-calificacion" className="p-4">
        <Text className="text-chico text-texto-tenue">El cliente todavía no calificó el servicio.</Text>
      </Tarjeta>
    );
  }

  const enviar = async () => {
    if (enviando || puntaje === 0) return;
    setEnviando(true);
    try {
      await calificarServicio(servicio.id, puntaje, comentario);
      onCalificado();
    } catch (error) {
      Alert.alert(
        'No se pudo calificar',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta testID="tarjeta-calificar" className="gap-3 p-4">
      <View className="gap-0.5">
        <Text className="text-sm font-bold text-texto">¿Cómo fue el servicio?</Text>
        <Text className="text-mini text-texto-tenue">
          Calificá a {servicio.mecanico?.nombre ?? 'tu mecánico'}. Ayuda a otros riders a elegir.
        </Text>
      </View>

      <View className="items-center gap-1.5 py-1">
        <Estrellas puntaje={puntaje} tamanio={34} onElegir={setPuntaje} />
        <Text className="text-chico text-texto-tenue">
          {puntaje ? TEXTO_PUNTAJE[puntaje] : 'Tocá una estrella'}
        </Text>
      </View>

      <CampoTexto
        testID="campo-comentario-calificacion"
        placeholder="Comentario (opcional)"
        value={comentario}
        onChangeText={setComentario}
        maxLength={300}
      />

      <Boton
        testID="btn-enviar-calificacion"
        titulo="Enviar calificación"
        icono="star"
        cargando={enviando}
        deshabilitado={enviando || puntaje === 0}
        onPress={enviar}
      />
    </Tarjeta>
  );
}
