import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { formatearHora } from '@/lib/formato';
import { descriptorEstado } from '@/lib/iconos';
import { COLORES } from '@/lib/tema';
import type { EstadoServicio, HitoServicio } from '@/types';

/** Recorrido normal de un servicio (RF-STATE-001). */
const FLUJO: EstadoServicio[] = ['pendiente', 'aceptado', 'en_camino', 'llegue', 'trabajando', 'finalizado'];

type Paso = {
  estado: EstadoServicio;
  hora: string | null;
  situacion: 'completado' | 'actual' | 'pendiente';
};

function armarPasos(estado: EstadoServicio, historial: HitoServicio[], creadoEn: string): Paso[] {
  const horaDe = (e: EstadoServicio) =>
    [...historial].reverse().find((h) => h.estado_nuevo === e)?.ocurrido_en ??
    (e === 'pendiente' ? creadoEn : null);

  // Cancelada: se muestran los pasos que llegaron a ocurrir y la cancelación al final.
  if (estado === 'cancelada') {
    const ocurridos = FLUJO.filter((e) => horaDe(e) !== null).map<Paso>((e) => ({
      estado: e,
      hora: horaDe(e),
      situacion: 'completado',
    }));
    return [...ocurridos, { estado: 'cancelada', hora: horaDe('cancelada'), situacion: 'actual' }];
  }

  const indiceActual = Math.max(FLUJO.indexOf(estado === 'solicitado' ? 'pendiente' : estado), 0);

  return FLUJO.map((e, i) => ({
    estado: e,
    hora: i <= indiceActual ? horaDe(e) : null,
    situacion: i < indiceActual ? 'completado' : i === indiceActual ? 'actual' : 'pendiente',
  }));
}

type LineaTiempoProps = {
  estado: EstadoServicio;
  historial: HitoServicio[];
  creadoEn: string;
};

/** Línea de tiempo del servicio: completados, actual y pendientes, con la hora de cada hito. */
export function LineaTiempo({ estado, historial, creadoEn }: LineaTiempoProps) {
  const pasos = armarPasos(estado, historial, creadoEn);

  return (
    <View>
      {pasos.map((paso, i) => {
        const descriptor = descriptorEstado(paso.estado);
        const esUltimo = i === pasos.length - 1;
        const alcanzado = paso.situacion !== 'pendiente';
        const colorIcono =
          paso.situacion === 'actual'
            ? COLORES[descriptor.tono]
            : alcanzado
              ? COLORES.textoInverso
              : COLORES.textoSutil;

        return (
          <View key={`${paso.estado}-${i}`} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full border-2',
                  paso.situacion === 'completado' && 'border-acento bg-acento',
                  paso.situacion === 'actual' && 'border-acento bg-acento/15',
                  paso.situacion === 'pendiente' && 'border-borde bg-superficie-alta',
                )}>
                <Ionicons
                  name={paso.situacion === 'completado' ? 'checkmark' : descriptor.icono}
                  size={15}
                  color={colorIcono}
                />
              </View>
              {!esUltimo ? (
                <View className={cn('w-0.5 flex-1', paso.situacion === 'completado' ? 'bg-acento' : 'bg-borde')} />
              ) : null}
            </View>

            <View className={cn('flex-1 flex-row items-start justify-between gap-2', !esUltimo && 'pb-5')}>
              <Text
                className={cn(
                  'pt-1.5 text-sm',
                  paso.situacion === 'actual' ? 'font-bold text-texto' : alcanzado ? 'text-texto' : 'text-texto-sutil',
                )}>
                {descriptor.etiqueta}
              </Text>
              <Text className="pt-1.5 text-mini text-texto-tenue">
                {paso.hora ? formatearHora(paso.hora) : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
