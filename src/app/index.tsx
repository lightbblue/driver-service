import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { HeroBanner } from '../components/hero-banner';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface MechanicItem {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  location: string;
  tags: string[];
}


const FEATURED_MECHANICS: MechanicItem[] = [
  {
    id: '1',
    name: 'Motos Pilar',
    rating: 4.8,
    reviews: 120,
    location: 'Pilar, Bs. As.',
    tags: ['Motos', 'Eléctrica', 'Emergencias'],
  },
  {
    id: '2',
    name: 'Lucho Motos',
    rating: 4.6,
    reviews: 98,
    location: 'Del Viso, Bs. As.',
    tags: ['Mecánica general', 'A domicilio'],
  },
  {
    id: '3',
    name: 'KM Racing',
    rating: 4.9,
    reviews: 64,
    location: 'Pilar, Bs. As.',
    tags: ['Motos', 'Inyección'],
  },
];

const TRAVEL_TIPS = [
  {
    id: 'tip-1',
    title: 'Revisión antes de salir',
    subtitle: '5 puntos clave para un viaje seguro',
    description: 'Revisá presión de neumáticos, nivel de aceite, luces, frenos y cadena. Cinco minutos que te pueden salvar el viaje.',
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&q=80',
  },
  {
    id: 'tip-2',
    title: '¿Qué hacer en caso de lluvia?',
    subtitle: 'Consejos y recomendaciones',
    description: 'Reducí la velocidad, aumentá la distancia de frenado y evitá frenar sobre las líneas del asfalto. Usá siempre casco y ropa impermeable.',
    imageUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&q=80',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        testID="home-scroll-view"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.brandBox}>
            <Ionicons name="shield-checkmark" size={22} color="#F5A623" />
            <View>
              <Text style={styles.brandTitle}>RIDER SERVICE</Text>
              <Text style={styles.brandSubtitle}>NUNCA VIAJES SOLO</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="btn-notifications"
              accessibilityRole="button"
              accessibilityLabel="Notificaciones"
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
              <View style={styles.notifDot} />
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-header-profile"
              accessibilityRole="button"
              accessibilityLabel="Perfil de usuario"
              style={styles.userBadge}
              onPress={() => router.push('/(tabs)/profile' as any)}
            >
              <View style={styles.avatarCircle}>
                <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.userName}>Hola, Thiago</Text>
                <Text style={styles.userRole}>Usuario</Text>
              </View>
              <Text style={styles.chevronSmall}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Hero Carrusel */}
        <HeroBanner />

        {/* 3. CTA Asistencia SOS */}
        <TouchableOpacity
          testID="btn-request-assistance"
          accessibilityRole="button"
          accessibilityLabel="Solicitar asistencia de emergencia"
          style={styles.sosButton}
          onPress={() => router.push('/solicitar-asistencia' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.sosBadge}>
            <Ionicons name="warning" size={26} color="#000000" />
          </View>
          <View style={styles.sosTextCol}>
            <Text style={styles.sosHeading}>Solicitar asistencia</Text>
            <Text style={styles.sosSubheading}>Obtené ayuda ahora</Text>
          </View>
          <Text style={styles.sosChevron}>›</Text>
        </TouchableOpacity>

        {/* 4. Grid de Accesos Rápidos */}
        <View style={styles.grid}>
          <TouchableOpacity
            testID="btn-quick-mechanics"
            accessibilityRole="button"
            accessibilityLabel="Mecánicos cerca tuyo"
            style={styles.gridCard}
            onPress={() => router.push('/(tabs)/map' as any)}
          >
            <Ionicons name="location" size={24} color="#F5A623" />
            <Text style={styles.gridLabel}>Mecánicos{'\n'}cerca tuyo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-quick-map"
            accessibilityRole="button"
            accessibilityLabel="Ver mapa"
            style={styles.gridCard}
            onPress={() => router.push('/(tabs)/map' as any)}
          >
            <Ionicons name="map-outline" size={24} color="#F5A623" />
            <Text style={styles.gridLabel}>Ver mapa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-quick-requests"
            accessibilityRole="button"
            accessibilityLabel="Mis solicitudes"
            style={styles.gridCard}
            onPress={() => router.push('/(tabs)/requests' as any)}
          >
            <Ionicons name="construct-outline" size={24} color="#F5A623" />
            <Text style={styles.gridLabel}>Mis solicitudes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-quick-community"
            accessibilityRole="button"
            accessibilityLabel="Comunidad Rider Service"
            style={styles.gridCard}
          >
            <Ionicons name="people-outline" size={24} color="#F5A623" />
            <Text style={styles.gridLabel}>Comunidad{'\n'}Rider Service</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Mecánicos destacados */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>Mecánicos destacados</Text>
          <TouchableOpacity testID="btn-see-all-mechanics">
            <Text style={styles.seeAllText}>Ver todos &gt;</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {FEATURED_MECHANICS.map((item) => (
            <View key={item.id} style={styles.mechCard} testID={`card-mechanic-${item.id}`}>
              <View style={styles.mechHeader}>
                <View style={styles.statusDot} />
                <Text style={styles.mechName} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.mechRatingRow}>
                <Ionicons name="star" size={12} color="#F5A623" />
                <Text style={styles.mechRating}> {item.rating} ({item.reviews})</Text>
              </View>
              <Text style={styles.mechLocation} numberOfLines={1}>{item.location}</Text>
              <View style={styles.tagWrap}>
                {item.tags.slice(0, 2).map((tag, idx) => (
                  <View key={idx} style={styles.tagPill}>
                    <Text style={styles.tagLabel}>{tag}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.mechButton} activeOpacity={0.8}>
                <Text style={styles.mechButtonText}>Ver perfil</Text>
                <Ionicons name="arrow-forward" size={12} color="#F5A623" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* 6. Consejos para tu viaje */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>Consejos para tu viaje</Text>
          <TouchableOpacity testID="btn-see-all-tips">
            <Text style={styles.seeAllText}>Ver todos &gt;</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {TRAVEL_TIPS.map((tip) => (
            <View
              key={tip.id}
              style={styles.tipCard}
              testID={`card-tip-${tip.id}`}
            >
              <Image source={{ uri: tip.imageUrl }} style={styles.tipImg} />
              <View style={styles.tipContent}>
                <Text style={styles.tipMainTitle}>{tip.title}</Text>
                <Text style={styles.tipSub}>{tip.subtitle}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#090C0E' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brandBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandTitle: { color: '#F5A623', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  brandSubtitle: { color: '#8E8E93', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#161B22', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30' },
  userBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20, gap: 6 },
  avatarCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2C3440', justifyContent: 'center', alignItems: 'center' },
  userName: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  userRole: { color: '#8E8E93', fontSize: 9 },
  chevronSmall: { color: '#8E8E93', fontSize: 14 },
  sosButton: { backgroundColor: '#F5A623', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 },
  sosBadge: { marginRight: 12 },
  sosTextCol: { flex: 1 },
  sosHeading: { color: '#000000', fontSize: 16, fontWeight: '800' },
  sosSubheading: { color: '#1C1C1E', fontSize: 12, fontWeight: '500' },
  sosChevron: { fontSize: 24, color: '#000000', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  gridCard: { width: (width - 42) / 2, backgroundColor: '#161B22', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#21262D', minHeight: 90, justifyContent: 'space-between' },
  gridLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 6 },
  sectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  seeAllText: { color: '#F5A623', fontSize: 12, fontWeight: '600' },
  horizontalScroll: { gap: 12, paddingBottom: 16, paddingRight: 16 },
  mechCard: { width: 190, minHeight: 130, backgroundColor: '#161B22', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#21262D' },
  mechHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#34C759' },
  mechName: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  mechRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  mechRating: { color: '#F5A623', fontSize: 12, fontWeight: '600' },
  mechLocation: { color: '#8E8E93', fontSize: 11, marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagPill: { backgroundColor: '#21262D', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagLabel: { color: '#8B949E', fontSize: 10 },
  mechButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#21262D' },
  mechButtonText: { color: '#F5A623', fontSize: 11, fontWeight: '600' },
  tipCard: { width: 260, borderRadius: 12, overflow: 'hidden', backgroundColor: '#161B22', borderWidth: 1, borderColor: '#21262D' },
  tipImg: { width: '100%', height: 110 },
  tipContent: { padding: 12 },
  tipMainTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  tipSub: { color: '#F5A623', fontSize: 11, fontWeight: '600', marginTop: 2 },
  tipDescription: { color: '#D1D5DB', fontSize: 11, marginTop: 8, lineHeight: 15 },
});