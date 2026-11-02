import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CampoTexto } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';
import { listarTalleres } from '@/services';
import type { TallerOpcion } from '@/types';

const MAXIMO_VISIBLES = 6;

type ElegirTallerProps = {
  elegido: TallerOpcion | null;
  onElegir: (taller: TallerOpcion | null) => void;
};

/** Buscador de los talleres de la app para que un mecánico se sume al suyo al registrarse. */
export function ElegirTaller({ elegido, onElegir }: ElegirTallerProps) {
  const talleres = useRecurso<TallerOpcion[]>(listarTalleres, []);
  const [busqueda, setBusqueda] = useState('');

  const texto = busqueda.trim().toLowerCase();
  const filtrados = talleres.datos
    .filter((t) => !texto || t.nombre.toLowerCase().includes(texto) || t.direccion.toLowerCase().includes(texto))
    .slice(0, MAXIMO_VISIBLES);

  if (elegido) {
    return (
      <View testID="taller-elegido" className="flex-row items-center gap-3 rounded-campo border border-acento bg-acento/10 p-3">
        <Ionicons name="storefront" size={20} color={COLORES.acento} />
        <View className="flex-1">
          <Text className="text-sm font-bold text-texto">{elegido.nombre}</Text>
          <Text className="text-mini text-texto-tenue" numberOfLines={1}>
            {elegido.direccion}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar de taller"
          hitSlop={8}
          onPress={() => onElegir(null)}>
          <Text className="text-chico font-bold text-acento">Cambiar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <CampoTexto
        testID="campo-buscar-taller"
        etiqueta="Tu taller"
        icono="search-outline"
        placeholder="Buscá por nombre o dirección"
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {talleres.cargando ? (
        <ActivityIndicator color={COLORES.acento} />
      ) : talleres.error ? (
        <Text className="text-mini text-peligro">{talleres.error}</Text>
      ) : filtrados.length === 0 ? (
        <Text className="text-mini text-texto-tenue">
          No encontramos ese taller. Si es nuevo, elegí &quot;Taller nuevo&quot; y cargalo.
        </Text>
      ) : (
        <View className="overflow-hidden rounded-campo border border-borde">
          {filtrados.map((taller, indice) => (
            <Pressable
              key={taller.id}
              testID={`opcion-taller-${taller.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${taller.nombre}`}
              onPress={() => onElegir(taller)}
              className={cn(
                'flex-row items-center gap-3 bg-superficie px-3 py-2.5 active:bg-superficie-alta',
                indice > 0 && 'border-t border-borde',
              )}>
              <Ionicons name="storefront-outline" size={17} color={COLORES.textoTenue} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-texto">{taller.nombre}</Text>
                <Text className="text-mini text-texto-tenue" numberOfLines={1}>
                  {taller.direccion}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
