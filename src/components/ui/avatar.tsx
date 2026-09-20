import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

type AvatarProps = {
  uri?: string | null;
  tamanio?: number;
  icono?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

/**
 * Avatar tolerante a datos ausentes (RNF-REL-001): sin URL o con URL caída
 * muestra el marcador de posición en lugar de romperse.
 */
export function Avatar({ uri, tamanio = 40, icono = 'person', className }: AvatarProps) {
  const [fallo, setFallo] = useState(false);
  const mostrarImagen = Boolean(uri) && !fallo;

  return (
    <View
      className={cn('items-center justify-center overflow-hidden bg-superficie-alta', className)}
      style={{ width: tamanio, height: tamanio, borderRadius: tamanio / 2 }}>
      {mostrarImagen ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: tamanio, height: tamanio }}
          contentFit="cover"
          transition={200}
          onError={() => setFallo(true)}
        />
      ) : (
        <Ionicons name={icono} size={tamanio * 0.55} color="#6B7280" />
      )}
    </View>
  );
}
