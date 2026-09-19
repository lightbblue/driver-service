import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const { width } = Dimensions.get('window');
const PADDING = 16;
const SLIDE_WIDTH = width - PADDING * 2;

const HERO_SLIDES = [
  { id: '1', title: 'Más rutas,\nmenos problemas', subtitle: 'Asistencia, comunidad y soporte siempre que lo necesites.' },
  { id: '2', title: 'Tu moto,\nsiempre lista', subtitle: 'Mecánicos verificados a un toque de distancia.' },
  { id: '3', title: 'Viajá tranquilo', subtitle: 'Cobertura en toda la ruta, las 24 horas.' },
];

export function HeroBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  };

  const goToSlide = (index: number) => {
    flatListRef.current?.scrollToOffset({ offset: index * SLIDE_WIDTH, animated: true });
    setActiveIndex(index);
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={HERO_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, index) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * index, index })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SLIDE_WIDTH }]}>
            <Text style={styles.heroTitle}>{item.title}</Text>
            <Text style={styles.heroSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />
      <View style={styles.dotsRow}>
        {HERO_SLIDES.map((slide, index) => (
          <TouchableOpacity
            key={slide.id}
            onPress={() => goToSlide(index)}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <View style={[styles.dot, index === activeIndex && styles.activeDot]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#161B22', borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#21262D', overflow: 'hidden', paddingTop: 18 },
  slide: { paddingHorizontal: 18, minHeight: 110 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  heroSubtitle: { color: '#8B949E', fontSize: 12, marginTop: 6, maxWidth: '90%' },
  dotsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingBottom: 16, paddingTop: 14, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#30363D' },
  activeDot: { backgroundColor: '#F5A623', width: 16 },
});