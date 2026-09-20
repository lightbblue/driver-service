import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

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

const ICONO = { chico: 20, mediano: 26, grande: 44 } as const;

/** Marca de la aplicación. Única fuente del logotipo en toda la interfaz. */
export function LogoRider({ tamanio = 'mediano', conLema = true, className }: LogoRiderProps) {
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <Ionicons name="shield-half" size={ICONO[tamanio]} color="#FFC107" />
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
