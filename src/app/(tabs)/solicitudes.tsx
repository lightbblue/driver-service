
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
  estado: string;
  creado_en: string;
};

type Categoria = {
  id: string;
  nombre: string;
};

const nombreEstado = (estado: string) => {
  const estados: Record<string, string> = {
    pendiente: 'Pendiente',
    solicitado: 'Solicitada',
    aceptado: 'Aceptada',
    en_camino: 'Mecánico en camino',
    llegue: 'Mecánico en el lugar',
    trabajando: 'En reparación',
    finalizado: 'Finalizada',
    cancelada: 'Cancelada',
  };

  return estados[estado] ?? estado;
};

const fechaLegible = (fecha: string) => {
  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return 'Fecha no disponible';
  }

  return fechaObj.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SolicitudesScreen() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState('');

  const cargarSolicitudes = useCallback(async () => {
    setErrorMensaje('');

    try {
      const {
        data: usuarioData,
        error: errorUsuario,
      } = await supabase.auth.getUser();

      if (errorUsuario) {
        throw errorUsuario;
      }

      if (!usuarioData.user) {
        setSolicitudes([]);
        setErrorMensaje(
          'Iniciá sesión para consultar tus solicitudes.',
        );
        return;
      }

      const { data, error } = await supabase
        .from('solicitudes')
        .select(
          'id, categoria_id, descripcion, direccion, estado, creado_en',
        )
        .eq('usuario_id', usuarioData.user.id)
        .order('creado_en', { ascending: false });

      if (error) {
        throw error;
      }

      const lista = (data ?? []) as Solicitud[];
      setSolicitudes(lista);

      const { data: categoriasData, error: errorCategorias } =
        await supabase
          .from('categorias_averia')
          .select('id, nombre');

      if (errorCategorias) {
        console.warn(
          '[MIS SOLICITUDES] No se pudieron cargar las categorías:',
          errorCategorias.message,
        );
      } else {
        setCategorias((categoriasData ?? []) as Categoria[]);
      }

      console.log(
        '[MIS SOLICITUDES] Solicitudes cargadas:',
        lista.length,
      );
    } catch (error) {
      console.error(
        '[MIS SOLICITUDES] Error al cargar:',
        error,
      );

      setErrorMensaje(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las solicitudes.',
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  const actualizarLista = () => {
    setActualizando(true);
    void cargarSolicitudes();
  };

  const obtenerNombreCategoria = (categoriaId: string | null) => {
    if (!categoriaId) return 'Asistencia mecánica';

    return (
      categorias.find((categoria) => categoria.id === categoriaId)
        ?.nombre ?? 'Asistencia mecánica'
    );
  };

  return (
    <View style={styles.pantalla}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Mis solicitudes</Text>
        <Text style={styles.subtitulo}>
          Consultá el estado de tus asistencias.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={actualizarLista}
          disabled={cargando || actualizando}
          style={styles.botonActualizar}
        >
          <Text style={styles.textoBotonActualizar}>
            {actualizando ? 'Actualizando...' : 'Actualizar lista'}
          </Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.textoSecundario}>
            Cargando tus solicitudes...
          </Text>
        </View>
      ) : errorMensaje ? (
        <View style={styles.centro}>
          <Text style={styles.error}>{errorMensaje}</Text>
          <Pressable
            onPress={actualizarLista}
            style={styles.botonReintentar}
          >
            <Text style={styles.textoBotonReintentar}>
              Intentar nuevamente
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={actualizarLista}
            />
          }
        >
          {solicitudes.length === 0 ? (
            <View style={styles.vacio}>
              <Text style={styles.iconoVacio}>📋</Text>
              <Text style={styles.tituloVacio}>
                Todavía no tenés solicitudes
              </Text>
              <Text style={styles.textoSecundario}>
                Cuando solicites asistencia, aparecerá acá.
              </Text>
            </View>
          ) : (
            solicitudes.map((solicitud) => (
              <Pressable
                key={solicitud.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/solicitud/[id]',
                    params: { id: solicitud.id },
                  })
                }
                style={styles.tarjeta}
              >
                <View style={styles.fila}>
                  <Text style={styles.categoria}>
                    {obtenerNombreCategoria(solicitud.categoria_id)}
                  </Text>

                  <View style={styles.etiquetaEstado}>
                    <Text style={styles.textoEstado}>
                      {nombreEstado(solicitud.estado)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fecha}>
                  {fechaLegible(solicitud.creado_en)}
                </Text>

                <Text style={styles.etiqueta}>Ubicación</Text>
                <Text style={styles.valor}>
                  {solicitud.direccion || 'Sin dirección registrada'}
                </Text>

                {solicitud.descripcion ? (
                  <>
                    <Text style={styles.etiqueta}>Descripción</Text>
                    <Text style={styles.valor}>
                      {solicitud.descripcion}
                    </Text>
                  </>
                ) : null}

                <Text style={styles.idSolicitud}>
                  Solicitud: {solicitud.id.slice(0, 8)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  encabezado: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  titulo: {
    fontSize: 27,
    fontWeight: '800',
    color: '#111827',
  },
  subtitulo: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
  },
  botonActualizar: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: '#dbeafe',
  },
  textoBotonActualizar: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  lista: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  tarjeta: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  categoria: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  etiquetaEstado: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  textoEstado: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  fecha: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 12,
    color: '#6b7280',
  },
  etiqueta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  valor: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 21,
    color: '#111827',
  },
  idSolicitud: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    fontSize: 11,
    color: '#9ca3af',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  textoSecundario: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    color: '#b91c1c',
    textAlign: 'center',
  },
  botonReintentar: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: '#2563eb',
  },
  textoBotonReintentar: {
    color: '#ffffff',
    fontWeight: '700',
  },
  vacio: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
    gap: 12,
  },
  iconoVacio: {
    fontSize: 40,
  },
  tituloVacio: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
});


