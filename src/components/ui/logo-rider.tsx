import { Image, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type LogoRiderProps = {
  tamanio?: 'chico' | 'mediano' | 'grande';
  conLema?: boolean;
  className?: string;
};

const TITULO = {
  chico: 'text-base',
  mediano: 'text-xl',
  grande: 'text-4xl',
} as const;

const ICONO = { chico: 34, mediano: 42, grande: 68 } as const;

/** Cubierta en movimiento con su taco, en el amarillo de la marca. PNG con fondo transparente. */
const RUEDA = require('../../../assets/images/logo-rueda.png');

/** Marca de la aplicación. Única fuente del logotipo en toda la interfaz. */
export function LogoRider({ tamanio = 'mediano', conLema = true, className }: LogoRiderProps) {
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <Image
        source={RUEDA}
        style={{ width: ICONO[tamanio], height: ICONO[tamanio] }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View>
        <Text className={cn('font-black tracking-wide text-texto', TITULO[tamanio])}>
          RIDER <Text className="text-acento">SERVICE</Text>
        </Text>
        {conLema ? (
          <Text className="text-micro font-bold tracking-[3px] text-texto-tenue">
            NUNCA VIAJES SOLO
          </Text>
        ) : null}
      </View>
    </View>
  );
}
