import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';

import { useRecurso } from '@/hooks/use-recurso';
import { cn } from '@/lib/cn';
import { COLORES } from '@/lib/tema';
import { cambiarDisponibilidad, obtenerDisponibilidad } from '@/services';

/**
 * Disponibilidad del mecánico (RF-PROF-003). Sin disponibilidad no ve ni acepta
 * solicitudes nuevas (RN-003) y su taller deja de figurar como disponible.
 */
export function InterruptorDisponibilidad() {
  const recurso = useRecurso<boolean | null>(obtenerDisponibilidad, null);
  const [local, setLocal] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);

  const disponible = local ?? recurso.datos;
  if (recurso.cargando && disponible == null) {
    return (
      <View className="items-center rounded-tarjeta border border-borde bg-superficie p-4">
        <ActivityIndicator color={COLORES.acento} />
      </View>
    );
  }
  if (disponible == null) return null;

  const cambiar = async (valor: boolean) => {
    if (guardando) return;
    setGuardando(true);
    setLocal(valor);
    try {
      await cambiarDisponibilidad(valor);
    } catch (error) {
      setLocal(!valor);
      Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View
      testID="interruptor-disponibilidad"
      className={cn(
        'flex-row items-center gap-3 rounded-tarjeta border p-4',
        disponible ? 'border-exito/40 bg-exito/10' : 'border-borde bg-superficie',
      )}>
      <View className={cn('h-10 w-10 items-center justify-center rounded-full', disponible ? 'bg-exito/20' : 'bg-superficie-alta')}>
        <Ionicons
          name={disponible ? 'radio-button-on' : 'pause-circle-outline'}
          size={20}
          color={disponible ? COLORES.exito : COLORES.textoTenue}
        />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-texto">
          {disponible ? 'Disponible para pedidos' : 'No disponible'}
        </Text>
        <Text className="text-mini text-texto-tenue">
          {disponible
            ? 'Recibís las solicitudes nuevas de tu zona y de tu taller.'
            : 'No recibís solicitudes nuevas. Tus servicios en curso siguen igual.'}
        </Text>
      </View>
      <Switch
        testID="switch-disponibilidad"
        accessibilityLabel="Disponible para recibir pedidos"
        value={disponible}
        disabled={guardando}
        onValueChange={(valor) => void cambiar(valor)}
        trackColor={{ false: COLORES.superficieAlta, true: COLORES.exito }}
        thumbColor={COLORES.texto}
      />
    </View>
  );
}
