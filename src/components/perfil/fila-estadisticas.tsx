import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { EstadisticasPerfil } from '@/types';

type Metrica = {
  id: string;
  icono: keyof typeof Ionicons.glyphMap;
  valor: string;
  etiqueta: string;
};

/** Fila de estadísticas del perfil, leída de `usuarios.json` (RF-VIEW-005). */
export function FilaEstadisticas({ estadisticas }: { estadisticas: EstadisticasPerfil | null }) {
  const metricas: Metrica[] = [
    {
      id: 'solicitudes',
      icono: 'reader-outline',
      valor: String(estadisticas?.solicitudes ?? 0),
      etiqueta: 'Solicitudes',
    },
    {
      id: 'resueltas',
      icono: 'time-outline',
      valor: String(estadisticas?.resueltas ?? 0),
      etiqueta: 'Resueltas',
    },
    {
      id: 'calificacion',
      icono: 'star',
      valor: estadisticas?.calificacion != null ? estadisticas.calificacion.toFixed(1) : '—',
      etiqueta: 'Calificación',
    },
    {
      id: 'miembro',
      icono: 'calendar-outline',
      valor: estadisticas?.miembro_desde ? `Desde ${estadisticas.miembro_desde}` : '—',
      etiqueta: 'Miembro',
    },
  ];

  return (
    <View className="flex-row rounded-tarjeta border border-borde bg-superficie py-4">
      {metricas.map((metrica, indice) => (
        <View key={metrica.id} className="flex-1 flex-row">
          {indice > 0 ? <View className="w-px self-stretch bg-borde" /> : null}
          <View className="flex-1 items-center gap-1 px-1">
            <Ionicons name={metrica.icono} size={19} color="#FFC107" />
            <Text className="text-center text-sm font-extrabold text-texto" numberOfLines={1}>
              {metrica.valor}
            </Text>
            <Text className="text-micro text-texto-tenue">{metrica.etiqueta}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
