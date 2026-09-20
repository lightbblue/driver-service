import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import type { PasoSolicitud } from '@/types';

type IndicadorPasosProps = {
  pasos: PasoSolicitud[];
  pasoActual: number;
};

/** Indicador de progreso permanente del flujo (RF-VIEW-006). */
export function IndicadorPasos({ pasos, pasoActual }: IndicadorPasosProps) {
  return (
    <View className="flex-row px-2 pb-4 pt-1">
      {pasos.map((paso, indice) => {
        const completado = paso.numero < pasoActual;
        const actual = paso.numero === pasoActual;

        return (
          <View key={paso.numero} className="flex-1 items-center">
            <View className="w-full flex-row items-center">
              {/* Tramo izquierdo de la línea */}
              <View
                className={cn(
                  'h-0.5 flex-1',
                  indice === 0 ? 'bg-transparent' : completado || actual ? 'bg-acento' : 'bg-borde',
                )}
              />
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`Paso ${paso.numero}: ${paso.titulo}`}
                accessibilityState={{ selected: actual }}
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full border-2',
                  completado
                    ? 'border-acento bg-acento'
                    : actual
                      ? 'border-acento bg-acento'
                      : 'border-borde bg-superficie',
                )}>
                {completado ? (
                  <Ionicons name="checkmark" size={16} color="#0B0B0D" />
                ) : (
                  <Text
                    className={cn(
                      'text-chico font-extrabold',
                      actual ? 'text-texto-inverso' : 'text-texto-tenue',
                    )}>
                    {paso.numero}
                  </Text>
                )}
              </View>
              {/* Tramo derecho de la línea */}
              <View
                className={cn(
                  'h-0.5 flex-1',
                  indice === pasos.length - 1
                    ? 'bg-transparent'
                    : completado
                      ? 'bg-acento'
                      : 'bg-borde',
                )}
              />
            </View>

            <Text
              className={cn(
                'mt-1.5 text-center text-micro font-semibold',
                actual ? 'text-acento' : completado ? 'text-texto' : 'text-texto-tenue',
              )}
              numberOfLines={1}>
              {paso.titulo}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
