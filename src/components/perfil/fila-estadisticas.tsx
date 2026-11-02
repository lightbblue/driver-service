import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { COLORES } from '@/lib/tema';
import type { EstadisticasPerfil } from '@/types';

type Metrica = {
  id: string;
  icono: keyof typeof Ionicons.glyphMap;
  valor: string;
  etiqueta: string;
};

/**
 * Estadísticas del mecánico en su perfil (RF-VIEW-005): cuántos servicios resolvió
 * y el promedio de estrellas que le dieron los clientes. No se muestran las
 * solicitudes tomadas: el cliente elige por las estrellas, no por el volumen.
 */
export function FilaEstadisticas({ estadisticas }: { estadisticas: EstadisticasPerfil }) {
  const metricas: Metrica[] = [
    {
      id: 'resueltas',
      icono: 'checkmark-done-outline',
      valor: String(estadisticas.resueltas),
      etiqueta: 'Resueltas',
    },
    {
      id: 'calificacion',
      icono: 'star',
      valor: estadisticas.calificacion != null ? estadisticas.calificacion.toFixed(1) : '—',
      etiqueta:
        estadisticas.cantidad_calificaciones > 0
          ? `Calificación (${estadisticas.cantidad_calificaciones})`
          : 'Calificación',
    },
  ];

  return (
    <View testID="fila-estadisticas" className="flex-row rounded-tarjeta border border-borde bg-superficie py-4">
      {metricas.map((metrica, indice) => (
        <View key={metrica.id} className="flex-1 flex-row">
          {indice > 0 ? <View className="w-px self-stretch bg-borde" /> : null}
          <View testID={`estadistica-${metrica.id}`} className="flex-1 items-center gap-1 px-1">
            <Ionicons name={metrica.icono} size={19} color={COLORES.acento} />
            <Text className="text-center text-base font-extrabold text-texto" numberOfLines={1}>
              {metrica.valor}
            </Text>
            <Text className="text-micro text-texto-tenue" numberOfLines={1}>
              {metrica.etiqueta}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
