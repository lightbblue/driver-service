import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { formatearFechaHora } from '@/lib/formato';
import { descriptorEstado } from '@/lib/iconos';
import { COLORES } from '@/lib/tema';
import { FLUJO_ESTADOS } from '@/services';
import type { EstadoServicio, HitoServicio, Servicio } from '@/types';

type Fila = { estado: EstadoServicio; hito: HitoServicio | null };

/**
 * Etapas del servicio con la fecha y la observación de cada cambio (REQ-05).
 * Las etapas que todavía no ocurrieron se muestran atenuadas; si la solicitud
 * se canceló, la lista termina en la cancelación.
 */
export function LineaTiempo({ servicio }: { servicio: Servicio }) {
  const ultimo = (estado: EstadoServicio) =>
    [...servicio.historial].reverse().find((h) => h.estado_nuevo === estado) ?? null;

  const filas: Fila[] =
    servicio.estado === 'cancelada'
      ? [
          ...FLUJO_ESTADOS.map((estado) => ({ estado, hito: ultimo(estado) })).filter((f) => f.hito || f.estado === 'pendiente'),
          { estado: 'cancelada', hito: ultimo('cancelada') },
        ]
      : FLUJO_ESTADOS.map((estado) => ({ estado, hito: ultimo(estado) }));

  return (
    <View testID="linea-tiempo">
      {filas.map((fila, indice) => {
        const d = descriptorEstado(fila.estado);
        const ocurrio = !!fila.hito || fila.estado === 'pendiente';
        const esUltima = indice === filas.length - 1;
        const fecha = fila.hito?.ocurrido_en ?? (fila.estado === 'pendiente' ? servicio.creado_en : null);

        return (
          <View key={fila.estado} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full border',
                  ocurrio ? 'border-transparent bg-superficie-alta' : 'border-borde bg-transparent',
                )}>
                <Ionicons name={d.icono} size={16} color={ocurrio ? d.colorIcono : COLORES.textoSutil} />
              </View>
              {!esUltima ? (
                <View className={cn('w-0.5 flex-1', ocurrio ? 'bg-borde' : 'bg-superficie-alta')} />
              ) : null}
            </View>

            <View className={cn('flex-1 gap-0.5', !esUltima && 'pb-4')}>
              <Text className={cn('text-sm font-bold', ocurrio ? 'text-texto' : 'text-texto-sutil')}>
                {d.hito}
              </Text>
              <Text className="text-mini text-texto-tenue">
                {fecha ? formatearFechaHora(fecha) : 'Pendiente'}
              </Text>
              {fila.hito?.observacion ? (
                <Text className="text-chico text-texto">“{fila.hito.observacion}”</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
