import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Boton, CampoTexto, Chip, Tarjeta } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatearMoneda } from '@/lib/formato';
import { COLORES } from '@/lib/tema';
import { aceptarPresupuesto, rechazarPresupuesto } from '@/services';
import type { MedioPago, Servicio } from '@/types';

/** Medios de pago. Mercado Pago es simulado: no pide datos ni cobra dinero real. */
const MEDIOS_PAGO: {
  valor: MedioPago;
  titulo: string;
  detalle: string;
  icono: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    valor: 'mercado_pago',
    titulo: 'Mercado Pago (simulado)',
    detalle: 'Se retiene ahora y se cobra cuando confirmes que quedó resuelto. Si no, se devuelve.',
    icono: 'wallet-outline',
  },
  {
    valor: 'efectivo',
    titulo: 'Efectivo',
    detalle: 'Le pagás al mecánico cuando termina el trabajo.',
    icono: 'cash-outline',
  },
];

const MOTIVOS_RECHAZO = ['Es muy caro', 'Conseguí otra ayuda', 'Ya lo resolví', 'Quiero otro presupuesto'];

type AceptarPrecioProps = {
  servicio: Servicio;
  onRespondido: () => void;
};

/**
 * El mecánico tomó la solicitud y le puso precio: el cliente lo acepta y elige cómo pagar
 * (recién ahí el mecánico sale), o lo rechaza y la solicitud vuelve a buscar mecánico.
 */
export function AceptarPrecio({ servicio, onRespondido }: AceptarPrecioProps) {
  const [medio, setMedio] = useState<MedioPago>('mercado_pago');
  const [enviando, setEnviando] = useState<'aceptar' | 'rechazar' | null>(null);
  // Para rechazar hay que contar por qué: el mecánico lo ve.
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const responder = async (accion: 'aceptar' | 'rechazar') => {
    if (enviando) return;
    if (accion === 'rechazar' && !motivo.trim()) {
      Alert.alert('Falta el motivo', 'Contale al mecánico por qué rechazás el precio.');
      return;
    }
    setEnviando(accion);
    try {
      if (accion === 'aceptar') await aceptarPresupuesto(servicio.id, medio);
      else await rechazarPresupuesto(servicio.id, motivo);
      onRespondido();
    } catch (error) {
      Alert.alert('No se pudo responder', error instanceof Error ? error.message : 'Intentá nuevamente.');
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Tarjeta testID="aceptar-precio" className="gap-3 border-acento/50 p-4">
      <View className="flex-row items-start gap-3">
        <Ionicons name="pricetag" size={22} color={COLORES.acento} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-extrabold text-texto">Te enviaron un precio</Text>
          <Text className="text-chico text-texto-tenue">
            {servicio.mecanico?.nombre ?? 'El mecánico'} cobra este precio por el servicio. Si lo aceptás, sale
            hacia tu ubicación.
          </Text>
        </View>
      </View>

      <Text testID="texto-precio-propuesto" className="text-center text-3xl font-extrabold text-acento">
        {formatearMoneda(servicio.monto_final)}
      </Text>

      <View className="gap-2">
        <Text className="text-sm font-bold text-texto">¿Cómo pagás?</Text>
        {MEDIOS_PAGO.map((opcion) => {
          const activo = medio === opcion.valor;
          return (
            <Pressable
              key={opcion.valor}
              testID={`medio-${opcion.valor}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              accessibilityLabel={`${opcion.titulo}. ${opcion.detalle}`}
              onPress={() => setMedio(opcion.valor)}
              className={cn(
                'flex-row items-center gap-3 rounded-campo border p-3 active:opacity-80',
                activo ? 'border-acento bg-acento/10' : 'border-borde bg-superficie',
              )}>
              <Ionicons name={opcion.icono} size={22} color={activo ? COLORES.acento : COLORES.textoTenue} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-texto">{opcion.titulo}</Text>
                <Text className="text-mini text-texto-tenue">{opcion.detalle}</Text>
              </View>
              <Ionicons
                name={activo ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={activo ? COLORES.acento : COLORES.textoSutil}
              />
            </Pressable>
          );
        })}
        {medio === 'mercado_pago' ? (
          <Text className="text-mini text-texto-tenue">Pago de prueba: no se cobra dinero real.</Text>
        ) : null}
      </View>

      <Boton
        testID="btn-aceptar-precio"
        titulo={medio === 'mercado_pago' ? `Aceptar y pagar ${formatearMoneda(servicio.monto_final)}` : 'Aceptar precio'}
        icono="checkmark-circle-outline"
        cargando={enviando === 'aceptar'}
        deshabilitado={!!enviando}
        onPress={() => void responder('aceptar')}
      />
      {rechazando ? (
        <View testID="panel-rechazo-precio" className="gap-2 rounded-campo border border-peligro/40 p-3">
          <Text className="text-sm font-bold text-texto">¿Por qué rechazás el precio?</Text>
          <View className="flex-row flex-wrap gap-2">
            {MOTIVOS_RECHAZO.map((m) => (
              <Chip key={m} texto={m} activo={motivo === m} onPress={() => setMotivo(m)} />
            ))}
          </View>
          <CampoTexto
            testID="campo-motivo-rechazo"
            placeholder="Motivo (obligatorio)"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={200}
          />
          <View className="flex-row gap-2">
            <Boton
              titulo="Volver"
              variante="secundario"
              className="flex-1"
              deshabilitado={!!enviando}
              onPress={() => setRechazando(false)}
            />
            <Boton
              testID="btn-confirmar-rechazo"
              titulo="Rechazar"
              variante="peligro"
              className="flex-1"
              cargando={enviando === 'rechazar'}
              deshabilitado={!!enviando}
              onPress={() => void responder('rechazar')}
            />
          </View>
        </View>
      ) : (
        <Boton
          testID="btn-rechazar-precio"
          titulo="Rechazar precio"
          variante="secundario"
          deshabilitado={!!enviando}
          onPress={() => setRechazando(true)}
        />
      )}
      <Text testID="texto-si-rechazo" className="text-mini text-texto-tenue">
        {servicio.destino
          ? `Si lo rechazás, la solicitud se cancela sin cargo, porque se la pediste a ${servicio.destino.nombre}. Podés pedir de nuevo con el SOS o a otro taller.`
          : 'Si lo rechazás, la solicitud vuelve a estar disponible para que otro mecánico te pase su precio.'}
      </Text>
    </Tarjeta>
  );
}
