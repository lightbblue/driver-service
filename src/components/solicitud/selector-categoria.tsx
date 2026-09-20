import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { iconoDeCategoria } from '@/lib/iconos';
import type { CategoriaAveria } from '@/types';

type SelectorCategoriaProps = {
  categorias: CategoriaAveria[];
  seleccionada: string | null;
  onSeleccionar: (codigo: string) => void;
};

/** Cuadrícula de tipos de avería. Al tocar una, la anterior se deselecciona. */
export function SelectorCategoria({
  categorias,
  seleccionada,
  onSeleccionar,
}: SelectorCategoriaProps) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      {categorias.map((categoria) => {
        const activa = categoria.codigo === seleccionada;

        return (
          <Pressable
            key={categoria.id}
            testID={`categoria-${categoria.codigo}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={categoria.nombre}
            onPress={() => onSeleccionar(categoria.codigo)}
            className={cn(
              'min-h-[92px] w-[23.5%] items-center justify-center gap-2 rounded-campo border px-1 py-3',
              activa
                ? 'border-acento bg-acento/10'
                : 'border-borde bg-superficie active:bg-superficie-alta',
            )}>
            <Ionicons
              name={iconoDeCategoria(categoria.icono)}
              size={26}
              color={activa ? '#FFC107' : '#FFFFFF'}
            />
            <Text
              className={cn(
                'text-center text-micro font-semibold leading-[13px]',
                activa ? 'text-acento' : 'text-texto',
              )}
              numberOfLines={2}>
              {categoria.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
