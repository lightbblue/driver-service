import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

export type OpcionConmutador<T extends string> = {
  valor: T;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
};

type ConmutadorProps<T extends string> = {
  opciones: OpcionConmutador<T>[];
  valor: T;
  onCambio: (valor: T) => void;
};

/** Selector de dos posiciones con la opción activa resaltada (RF-VIEW-003). */
export function Conmutador<T extends string>({ opciones, valor, onCambio }: ConmutadorProps<T>) {
  return (
    <View className="flex-row gap-2 rounded-campo border border-borde bg-superficie p-1.5">
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;

        return (
          <Pressable
            key={opcion.valor}
            testID={`conmutador-${opcion.valor}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={opcion.etiqueta}
            onPress={() => onCambio(opcion.valor)}
            className={cn(
              'min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-campo px-3 py-2.5',
              activa ? 'bg-acento' : 'bg-transparent active:bg-superficie-alta',
            )}>
            <Ionicons
              name={opcion.icono}
              size={17}
              color={activa ? '#0B0B0D' : '#9CA3AF'}
            />
            <Text
              className={cn(
                'text-sm font-bold',
                activa ? 'text-texto-inverso' : 'text-texto-tenue',
              )}>
              {opcion.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
