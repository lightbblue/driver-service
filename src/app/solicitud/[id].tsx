import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Solicitud = {
  id: string;
  categoria_id: string | null;
  descripcion: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  creado_en: string;
  mecanico_id: string | null;
};

const estados: Record<string, string> = {
  pendiente: 'Pendiente de asignación',
  solicitado: 'Solicitud recibida',
  aceptado: 'Aceptada por el mecánico',
  en_camino: 'Mecánico en camino',
  llegue: 'Mecánico en el lugar',
  trabajando: 'Trabajo en curso',
  finalizado: 'Servicio finalizado',
  cancelada: 'Solicitud cancelada',
};

function fechaLegible(fecha: string) {
  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return valor.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DetalleSolicitudScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [categoria, setCategoria] = useState('Asistencia mecánica');
  const [cargando, setCargando] = useState(true);
  const [errorMensaje, setErrorMensaje] = useState('');

  const cargarDetalle = useCallback(async () => {
    setCargando(true);
    setErrorMensaje('');

    try {
      if (!id) {
        throw new Error('No se indicó el identificador de la solicitud.');
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Iniciá sesión para consultar esta solicitud.');
      }

      const { data, error } = await supabase
        .from('solicitudes')
        .select(
          'id, categoria_id, descripcion, direccion, latitud, longitud, estado, creado_en, mecanico_id',
        )
        .eq('id', id)
        .eq('usuario_id', authData.user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'No encontramos esta solicitud o no tenés permiso para verla.',
        );
      }

      setSolicitud(data as Solicitud);

      if (data.categoria_id) {
        const { data: categoriaData, error: categoriaError } =
          await supabase
            .from('categorias_averia')
            .select('nombre')
            .eq('id', data.categoria_id)
            .maybeSingle();

        if (!categoriaError && categoriaData?.nombre) {
          setCategoria(categoriaData.nombre);
        }
      }
    } catch (error) {
      console.error('[DETALLE SOLICITUD] Error:', error);

      setErrorMensaje(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la solicitud.',
      );
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    void cargarDetalle();
  }, [cargarDetalle]);

  return (
    <ScrollView contentContainerStyle={styles.pantalla}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.botonVolver}
      >
        <Text style={styles.textoVolver}>‹ Volver a mis solicitudes</Text>
      </Pressable>

      <Text style={styles.titulo}>Detalle de solicitud</Text>
      <Text style={styles.subtitulo}>
        Información registrada en Rider Service.
      </Text>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.secundario}>Cargando solicitud...</Text>
        </View>
      ) : errorMensaje ? (
        <View style={styles.tarjeta}>
          <Text style={styles.error}>{errorMensaje}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => void cargarDetalle()}
            style={styles.botonReintentar}
          >
            <Text style={styles.textoBoton}>Intentar nuevamente</Text>
          </Pressable>
        </View>
      ) : solicitud ? (
        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>Categoría</Text>
          <Text style={styles.valor}>{categoria}</Text>

          <Text style={styles.etiqueta}>Estado actual</Text>
          <Text style={styles.estado}>
            {estados[solicitud.estado] ?? solicitud.estado}
          </Text>

          <Text style={styles.etiqueta}>Fecha de creación</Text>
          <Text style={styles.valor}>
            {fechaLegible(solicitud.creado_en)}
          </Text>

          <Text style={styles.etiqueta}>Ubicación</Text>
          <Text style={styles.valor}>
            {solicitud.direccion || 'Sin dirección registrada'}
          </Text>

          {solicitud.latitud != null &&
          solicitud.longitud != null ? (
            <Text style={styles.coordenadas}>
              Coordenadas: {solicitud.latitud}, {solicitud.longitud}
            </Text>
          ) : null}

          <Text style={styles.etiqueta}>Descripción</Text>
          <Text style={styles.valor}>
            {solicitud.descripcion || 'Sin descripción adicional'}
          </Text>

          <Text style={styles.etiqueta}>Identificador</Text>
          <Text selectable style={styles.identificador}>
            {solicitud.id}
          </Text>

          <Text style={styles.nota}>
            {solicitud.mecanico_id
              ? 'La solicitud tiene un mecánico asociado.'
              : 'Todavía no hay un mecánico asociado a esta solicitud.'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 28,
    backgroundColor: '#f5f7fb',
  },
  botonVolver: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    marginBottom: 12,
  },
  textoVolver: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '700',
  },
  titulo: {
    fontSize: 27,
    fontWeight: '800',
    color: '#111827',
  },
  subtitulo: {
    marginTop: 6,
    marginBottom: 20,
    color: '#6b7280',
    fontSize: 14,
  },
  tarjeta: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  etiqueta: {
    marginTop: 14,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  valor: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  estado: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  coordenadas: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  identificador: {
    fontSize: 12,
    color: '#4b5563',
  },
  nota: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    color: '#4b5563',
    fontSize: 13,
    lineHeight: 19,
  },
  centro: {
    padding: 30,
    alignItems: 'center',
    gap: 12,
  },
  secundario: {
    color: '#6b7280',
  },
  error: {
    color: '#b91c1c',
    lineHeight: 21,
  },
  botonReintentar: {
    marginTop: 16,
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  textoBoton: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
});
