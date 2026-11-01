import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { cn } from '@/lib/cn';
import type { Promocion } from '@/types';

const ALTO = 200;

/** Carrusel promocional del Home con indicadores de posición (RF-VIEW-004). */
export function CarruselPromociones({ promociones }: { promociones: Promocion[] }) {
  // Ancho real del interior de la tarjeta (sin el borde): así cada foto la cubre entera.
  const [anchoSlide, setAnchoSlide] = useState(0);
  const [activo, setActivo] = useState(0);
  const listaRef = useRef<FlatList<Promocion>>(null);

  if (promociones.length === 0) return null;

  const alMedir = (evento: LayoutChangeEvent) => {
    setAnchoSlide(Math.round(evento.nativeEvent.layout.width));
  };

  const alTerminarScroll = (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (anchoSlide > 0) setActivo(Math.round(evento.nativeEvent.contentOffset.x / anchoSlide));
  };

  const irA = (indice: number) => {
    listaRef.current?.scrollToOffset({ offset: indice * anchoSlide, animated: true });
    setActivo(indice);
  };

  return (
    <View
      onLayout={alMedir}
      style={{ height: ALTO }}
      className="mb-4 overflow-hidden rounded-tarjeta border border-borde bg-superficie">
      {anchoSlide > 0 ? (
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
            <View style={{ width: anchoSlide, height: '100%' }} className="justify-end">
              {item.imagen_url ? (
                <Image
                  source={{ uri: item.imagen_url }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  contentFit="cover"
                  transition={250}
                />
              ) : null}

              {/* Velo para que el texto se lea sobre cualquier foto (RNF-UX-005) */}
              <View className="absolute inset-0 bg-fondo/60" />

              {/* Abajo queda lugar para los indicadores, que van encima de la foto */}
              <View className="gap-1 px-5 pb-9">
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
      ) : null}

      <View className="absolute bottom-4 left-5 flex-row items-center gap-1.5">
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
