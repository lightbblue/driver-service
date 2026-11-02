import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { Tarjeta } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { COLORES } from '@/lib/tema';
import { agregarFotoTaller, eliminarFotoTaller, listarFotosTaller } from '@/services';
import type { FotoTaller } from '@/types';

const MAXIMO_FOTOS = 10;

/** Fotos del taller en Mi taller: el dueño agrega y borra; los mecánicos solo las ven. */
export function GaleriaMiTaller({ tallerId, esDueno }: { tallerId: string; esDueno: boolean }) {
  const fotos = useRecurso<FotoTaller[]>(() => listarFotosTaller(tallerId), [], [tallerId]);
  const { recargar } = fotos;
  const [ocupado, setOcupado] = useState<string | null>(null);

  const agregar = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    const imagen = resultado.canceled ? null : resultado.assets[0];
    if (!imagen?.base64) return;

    setOcupado('nueva');
    try {
      await agregarFotoTaller(imagen.base64, imagen.mimeType);
      recargar();
    } catch (error) {
      Alert.alert('No se pudo agregar la foto', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setOcupado(null);
    }
  };

  const borrar = (foto: FotoTaller) =>
    Alert.alert('Borrar foto', 'Deja de verse en el detalle del taller.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          setOcupado(foto.id);
          try {
            await eliminarFotoTaller(foto.id);
            recargar();
          } catch (error) {
            Alert.alert('No se pudo borrar', error instanceof Error ? error.message : 'Intentá nuevamente.');
          } finally {
            setOcupado(null);
          }
        },
      },
    ]);

  if (!esDueno && fotos.datos.length === 0) return null;

  return (
    <Tarjeta testID="galeria-mi-taller" className="gap-3 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-texto">
          Fotos ({fotos.datos.length}/{MAXIMO_FOTOS})
        </Text>
        {esDueno ? <Text className="text-mini text-texto-tenue">Las ven los clientes en el mapa</Text> : null}
      </View>

      {fotos.cargando && fotos.datos.length === 0 ? (
        <ActivityIndicator color={COLORES.acento} />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {fotos.datos.map((foto) => (
            <View key={foto.id} className="h-24 w-24 overflow-hidden rounded-campo bg-superficie-alta">
              <Image source={{ uri: foto.url }} className="h-full w-full" resizeMode="cover" />
              {esDueno ? (
                <Pressable
                  testID={`btn-borrar-foto-${foto.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar foto"
                  hitSlop={6}
                  onPress={() => borrar(foto)}
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-fondo/80">
                  {ocupado === foto.id ? (
                    <ActivityIndicator size="small" color={COLORES.texto} />
                  ) : (
                    <Ionicons name="close" size={14} color={COLORES.texto} />
                  )}
                </Pressable>
              ) : null}
            </View>
          ))}

          {esDueno && fotos.datos.length < MAXIMO_FOTOS ? (
            <Pressable
              testID="btn-agregar-foto-taller"
              accessibilityRole="button"
              accessibilityLabel="Agregar foto del taller"
              disabled={!!ocupado}
              onPress={() => void agregar()}
              className="h-24 w-24 items-center justify-center gap-1 rounded-campo border border-dashed border-borde bg-superficie active:bg-superficie-alta">
              {ocupado === 'nueva' ? (
                <ActivityIndicator color={COLORES.acento} />
              ) : (
                <>
                  <Ionicons name="add" size={22} color={COLORES.acento} />
                  <Text className="text-mini text-texto-tenue">Agregar</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </Tarjeta>
  );
}
