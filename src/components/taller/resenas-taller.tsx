import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { Avatar, Boton, CampoTexto } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { formatearFechaHora } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { listarResenasTaller, resenarTaller } from '@/services';
import type { ResenaTaller } from '@/types';

const ESTRELLAS = [1, 2, 3, 4, 5];
const VISIBLES = 3;

type Datos = { resenas: ResenaTaller[]; puedeResenar: boolean };

function Estrellas({ puntaje, tamanio = 13, onElegir }: { puntaje: number; tamanio?: number; onElegir?: (n: number) => void }) {
  return (
    <View className="flex-row gap-1">
      {ESTRELLAS.map((n) => (
        <Pressable
          key={n}
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
 * Reseñas del taller en su detalle (aparte de la calificación de cada mecánico).
 * Quien ya fue atendido por el taller puede dejar (o cambiar) la suya.
 */
export function ResenasTaller({ tallerId, onCambio }: { tallerId: string; onCambio?: () => void }) {
  const datos = useRecurso<Datos>(() => listarResenasTaller(tallerId), { resenas: [], puedeResenar: false }, [tallerId]);
  const { recargar } = datos;
  const mia = datos.datos.resenas.find((r) => r.es_mia) ?? null;

  const [escribiendo, setEscribiendo] = useState(false);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verTodas, setVerTodas] = useState(false);

  const empezar = () => {
    setPuntaje(mia?.puntaje ?? 0);
    setComentario(mia?.comentario ?? '');
    setEscribiendo(true);
  };

  const enviar = async () => {
    if (puntaje === 0 || enviando) return;
    setEnviando(true);
    try {
      await resenarTaller(tallerId, puntaje, comentario);
      setEscribiendo(false);
      recargar();
      onCambio?.();
    } catch (error) {
      Alert.alert('No se pudo guardar la reseña', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const lista = verTodas ? datos.datos.resenas : datos.datos.resenas.slice(0, VISIBLES);

  return (
    <View testID="resenas-taller" className="mt-4 gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-mini font-bold uppercase tracking-wider text-texto-tenue">
          Reseñas del taller ({datos.datos.resenas.length})
        </Text>
        {datos.datos.puedeResenar && !escribiendo ? (
          <Pressable testID="btn-resenar-taller" accessibilityRole="button" hitSlop={8} onPress={empezar}>
            <Text className="text-chico font-bold text-acento">{mia ? 'Editar mi reseña' : 'Dejar reseña'}</Text>
          </Pressable>
        ) : null}
      </View>

      {escribiendo ? (
        <View className="gap-2.5 rounded-xl border border-acento/40 bg-fondo p-3">
          <View className="items-center">
            <Estrellas puntaje={puntaje} tamanio={30} onElegir={setPuntaje} />
          </View>
          <CampoTexto
            testID="campo-resena-taller"
            placeholder="Contá cómo te atendieron (opcional)"
            value={comentario}
            onChangeText={setComentario}
            maxLength={300}
          />
          <View className="flex-row gap-2">
            <Boton titulo="Cancelar" variante="secundario" className="flex-1" onPress={() => setEscribiendo(false)} />
            <Boton
              testID="btn-enviar-resena-taller"
              titulo="Publicar"
              className="flex-1"
              cargando={enviando}
              deshabilitado={enviando || puntaje === 0}
              onPress={() => void enviar()}
            />
          </View>
        </View>
      ) : null}

      {datos.cargando && datos.datos.resenas.length === 0 ? (
        <ActivityIndicator color={COLORES.acento} />
      ) : datos.datos.resenas.length === 0 ? (
        <Text className="text-xs text-texto-tenue">
          Todavía no tiene reseñas.{datos.datos.puedeResenar ? ' Sé el primero en contar cómo te fue.' : ''}
        </Text>
      ) : (
        lista.map((r) => (
          <View key={r.id} testID={`resena-${r.id}`} className="gap-1 rounded-xl border border-borde bg-fondo p-3">
            <View className="flex-row items-center gap-2">
              <Avatar uri={r.avatar_url} tamanio={26} />
              <Text className="flex-1 text-xs font-bold text-texto" numberOfLines={1}>
                {r.es_mia ? 'Vos' : r.nombre}
              </Text>
              <Estrellas puntaje={r.puntaje} />
            </View>
            {r.comentario ? <Text className="text-xs text-texto">{r.comentario}</Text> : null}
            <Text className="text-micro text-texto-sutil">{formatearFechaHora(r.creado_en)}</Text>
          </View>
        ))
      )}

      {!verTodas && datos.datos.resenas.length > VISIBLES ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setVerTodas(true)}>
          <Text className="text-chico font-bold text-acento">Ver las {datos.datos.resenas.length} reseñas</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
