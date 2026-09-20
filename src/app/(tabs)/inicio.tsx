import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { AccesosRapidos, type AccesoRapido } from '@/components/home/accesos-rapidos';
import { CarruselPromociones } from '@/components/home/carrusel-promociones';
import { EncabezadoHome } from '@/components/home/encabezado-home';
import { TarjetaConsejo } from '@/components/home/tarjeta-consejo';
import { TarjetaMecanico } from '@/components/home/tarjeta-mecanico';
import { Cargando, EncabezadoSeccion, ListaVacia, Pantalla } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import {
  listarConsejos,
  listarMecanicosDestacados,
  listarPromociones,
  obtenerUsuarioActual,
} from '@/services';
import type { Consejo, Mecanico, Perfil, Promocion } from '@/types';

/**
 * Pantalla de Inicio (RF-VIEW-004).
 * Todo el contenido variable llega desde `/services`; esta vista no importa ningún JSON.
 */
export default function HomeScreen() {
  const router = useRouter();

  const usuario = useRecurso<Perfil | null>(obtenerUsuarioActual, null);
  const promociones = useRecurso<Promocion[]>(listarPromociones, []);
  const mecanicos = useRecurso<Mecanico[]>(() => listarMecanicosDestacados(), []);
  const consejos = useRecurso<Consejo[]>(listarConsejos, []);

  const accesos: AccesoRapido[] = [
    {
      id: 'mecanicos',
      etiqueta: 'Mecánicos\ncerca tuyo',
      icono: 'location-outline',
      onPress: () => router.push('/mapa'),
    },
    {
      id: 'mapa',
      etiqueta: 'Ver mapa',
      icono: 'map-outline',
      onPress: () => router.push('/mapa'),
    },
    {
      id: 'solicitudes',
      etiqueta: 'Mis\nsolicitudes',
      icono: 'construct-outline',
      onPress: () => router.push('/solicitudes'),
    },
    // Comunidad es COULD y queda fuera del mapa de pantallas: se renderiza sin navegar.
    { id: 'comunidad', etiqueta: 'Comunidad\nRider Service', icono: 'people-outline' },
  ];

  return (
    <Pantalla>
      <ScrollView
        testID="home-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-10 pt-2">
        <EncabezadoHome usuario={usuario.datos} onPressPerfil={() => router.push('/perfil')} />

        {promociones.cargando ? (
          <View className="mb-4 h-[188px] items-center justify-center rounded-tarjeta border border-borde bg-superficie">
            <Cargando mensaje="" />
          </View>
        ) : (
          <CarruselPromociones promociones={promociones.datos} />
        )}

        {/* Acción dominante de la pantalla (RF-VIEW-004) */}
        <Pressable
          testID="btn-solicitar-asistencia"
          accessibilityRole="button"
          accessibilityLabel="Solicitar asistencia. Obtené ayuda ahora"
          onPress={() => router.push('/solicitud/nueva')}
          className="mb-5 min-h-[76px] flex-row items-center gap-3 rounded-tarjeta bg-acento px-5 py-4 active:bg-acento-oscuro">
          <Ionicons name="warning" size={30} color="#0B0B0D" />
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-texto-inverso">Solicitar asistencia</Text>
            <Text className="text-chico font-medium text-texto-inverso/75">Obtené ayuda ahora</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#0B0B0D" />
        </Pressable>

        <AccesosRapidos accesos={accesos} />

        <EncabezadoSeccion titulo="Mecánicos destacados" accion="Ver todos" onPressAccion={() => router.push('/mapa')} />
        {mecanicos.cargando ? (
          <Cargando mensaje="Buscando mecánicos…" />
        ) : mecanicos.datos.length === 0 ? (
          <ListaVacia
            titulo="Todavía no hay mecánicos destacados"
            detalle="Cuando haya prestadores disponibles en tu zona, los vas a ver acá."
            icono="construct-outline"
          />
        ) : (
          <FlatList
            data={mecanicos.datos}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 pb-1 pr-4"
            renderItem={({ item }) => <TarjetaMecanico mecanico={item} />}
          />
        )}

        <View className="mt-7">
          <EncabezadoSeccion titulo="Consejos para tu viaje" accion="Ver todos" />
        </View>
        {consejos.cargando ? (
          <Cargando mensaje="" />
        ) : consejos.datos.length === 0 ? (
          <ListaVacia titulo="Sin consejos por ahora" icono="bulb-outline" />
        ) : (
          <FlatList
            data={consejos.datos}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 pb-1 pr-4"
            renderItem={({ item }) => <TarjetaConsejo consejo={item} />}
          />
        )}
      </ScrollView>
    </Pantalla>
  );
}
