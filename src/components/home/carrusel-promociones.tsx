import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { cn } from '@/lib/cn';
import type { Promocion } from '@/types';

const MARGEN = 16;

/** Carrusel promocional del Home con indicadores de posición (RF-VIEW-004). */
export function CarruselPromociones({ promociones }: { promociones: Promocion[] }) {
  const { width } = useWindowDimensions();
  const anchoSlide = width - MARGEN * 2;
  const [activo, setActivo] = useState(0);
  const listaRef = useRef<FlatList<Promocion>>(null);

  if (promociones.length === 0) return null;

  const alTerminarScroll = (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActivo(Math.round(evento.nativeEvent.contentOffset.x / anchoSlide));
  };

  const irA = (indice: number) => {
    listaRef.current?.scrollToOffset({ offset: indice * anchoSlide, animated: true });
    setActivo(indice);
  };

  return (
    <View className="mb-4 overflow-hidden rounded-tarjeta border border-borde bg-superficie">
      <FlatList
        ref={listaRef}
        data={promociones}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={alTerminarScroll}
        getItemLayout={(_, index) => ({
          length: anchoSlide,
          offset: anchoSlide * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width: anchoSlide }} className="h-[188px] justify-end">
            {item.imagen_url ? (
              <Image
                source={{ uri: item.imagen_url }}
                style={{ position: 'absolute', width: anchoSlide, height: 188 }}
                contentFit="cover"
                transition={250}
              />
            ) : null}

            {/* Velo para que el texto se lea sobre cualquier foto (RNF-UX-005) */}
            <View className="absolute inset-0 bg-fondo/60" />

            <View className="gap-1 p-5">
              <Text className="text-2xl font-extrabold leading-7 text-texto">
                {item.titulo}
                {item.titulo_destacado ? (
                  <Text className="text-acento">{`\n${item.titulo_destacado}`}</Text>
                ) : null}
              </Text>
              <Text className="max-w-[85%] text-chico text-texto-tenue">{item.bajada}</Text>
            </View>
          </View>
        )}
      />

      <View className="flex-row items-center gap-1.5 px-5 pb-4">
        {promociones.map((promo, indice) => (
          <Pressable
            key={promo.id}
            accessibilityRole="button"
            accessibilityLabel={`Ir a la promoción ${indice + 1}`}
            hitSlop={10}
            onPress={() => irA(indice)}>
            <View
              className={cn(
                'h-1.5 rounded-full',
                indice === activo ? 'w-5 bg-acento' : 'w-1.5 bg-borde',
              )}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
