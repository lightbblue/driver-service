import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';
import { listarFotosTaller } from '@/services';
import type { FotoTaller } from '@/types';

const ALTO = 170;

function Flecha({ lado, onPress }: { lado: 'izquierda' | 'derecha'; onPress: () => void }) {
  return (
    <Pressable
      testID={`flecha-${lado}`}
      accessibilityRole="button"
      accessibilityLabel={lado === 'izquierda' ? 'Foto anterior' : 'Foto siguiente'}
      hitSlop={8}
      onPress={onPress}
      // La posición va en estilo fijo: con clases condicionales NativeWind a veces no aplica
      // `right-2` y las dos flechas quedaban superpuestas a la izquierda.
      style={[{ position: 'absolute', top: ALTO / 2 - 16 }, lado === 'izquierda' ? { left: 8 } : { right: 8 }]}
      className="h-8 w-8 items-center justify-center rounded-full bg-fondo/70 active:bg-fondo">
      <Ionicons name={lado === 'izquierda' ? 'chevron-back' : 'chevron-forward'} size={20} color={COLORES.texto} />
    </Pressable>
  );
}

/**
 * Fotos del taller en el detalle del mapa, para que el cliente vea el lugar.
 * El ancho se mide en píxeles: en la web el 100 % no funciona dentro de un scroll horizontal.
 */
export function SliderFotosTaller({ tallerId }: { tallerId: string }) {
  const fotos = useRecurso<FotoTaller[]>(() => listarFotosTaller(tallerId), [], [tallerId]);
  const [ancho, setAncho] = useState(0);
  const [activa, setActiva] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  if (fotos.datos.length === 0) return null;

  const medir = (evento: LayoutChangeEvent) => setAncho(evento.nativeEvent.layout.width);
  const alDesplazar = (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!ancho) return;
    const indice = Math.round(evento.nativeEvent.contentOffset.x / ancho);
    const acotado = Math.min(Math.max(indice, 0), fotos.datos.length - 1);
    if (acotado !== activa) setActiva(acotado);
  };

  // Las flechas avisan que hay más fotos y permiten pasarlas sin deslizar.
  const irA = (indice: number) => {
    const destino = Math.min(Math.max(indice, 0), fotos.datos.length - 1);
    scrollRef.current?.scrollTo({ x: destino * ancho, animated: true });
    setActiva(destino);
  };
  const hayVarias = fotos.datos.length > 1;

  return (
    <View testID="slider-fotos-taller" onLayout={medir} style={{ height: ALTO }} className="mt-4 overflow-hidden rounded-xl bg-superficie-alta">
      {ancho > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={alDesplazar}
          scrollEventThrottle={32}>
          {fotos.datos.map((foto) => (
            <Image key={foto.id} source={{ uri: foto.url }} style={{ width: ancho, height: ALTO }} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}

      {hayVarias && activa > 0 ? (
        <Flecha lado="izquierda" onPress={() => irA(activa - 1)} />
      ) : null}
      {hayVarias && activa < fotos.datos.length - 1 ? (
        <Flecha lado="derecha" onPress={() => irA(activa + 1)} />
      ) : null}

      {hayVarias ? (
        <View className="absolute bottom-2 left-0 right-0 flex-row justify-center gap-1.5">
          {fotos.datos.map((foto, indice) => (
            <View
              key={foto.id}
              className={cn('h-1.5 rounded-full', indice === activa ? 'w-4 bg-acento' : 'w-1.5 bg-texto/60')}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
