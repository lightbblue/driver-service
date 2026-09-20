import { Image } from 'expo-image';
import { View } from 'react-native';

/**
 * Imagen de fondo de marca con velo de contraste.
 *
 * Es parte del sistema de diseño, no contenido: por eso vive acá y no en un JSON.
 * El velo garantiza el contraste mínimo de texto sobre foto (RNF-UX-005).
 */
const FONDOS = {
  ruta: 'https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=1200&q=80',
  taller: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200&q=80',
  montania: 'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=1200&q=80',
} as const;

type FondoMarcaProps = {
  variante?: keyof typeof FONDOS;
  /** Intensidad del velo: `fuerte` para pantallas con formularios encima. */
  velo?: 'suave' | 'fuerte';
};

export function FondoMarca({ variante = 'ruta', velo = 'fuerte' }: FondoMarcaProps) {
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Image
        source={{ uri: FONDOS[variante] }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={300}
      />
      <View className={velo === 'fuerte' ? 'absolute inset-0 bg-fondo/80' : 'absolute inset-0 bg-fondo/55'} />
    </View>
  );
}
