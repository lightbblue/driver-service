import { Ionicons } from '@expo/vector-icons';
import { Modal, Text, TouchableWithoutFeedback, View } from 'react-native';

import { Boton } from '@/components/ui';
import { COLORES } from '@/lib/tema';

export type ModalCerrarSesionProps = {
  visible: boolean;
  cargando?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
};

/**
 * Modal de confirmación para el cierre de sesión (RF-AUTH-005).
 * Despliega una advertencia que solicita confirmación explícita
 * para evitar cierres de sesión accidentales.
 */
export function ModalCerrarSesion({
  visible,
  cargando = false,
  onCancelar,
  onConfirmar,
}: ModalCerrarSesionProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cargando ? undefined : onCancelar}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={cargando ? undefined : onCancelar}>
        <View className="flex-1 items-center justify-center bg-black/70 px-5">
          <TouchableWithoutFeedback>
            <View
              testID="modal-confirmar-cierre"
              accessibilityRole="alert"
              accessibilityLabel="Confirmar cierre de sesión"
              className="w-full max-w-sm rounded-2xl border border-borde bg-superficie p-6 shadow-2xl"
            >
              {/* Ícono distintivo de cierre de sesión */}
              <View className="mx-auto mb-4 h-14 w-14 items-center justify-center rounded-full bg-peligro/15">
                <Ionicons name="log-out-outline" size={28} color={COLORES.peligro} />
              </View>

              {/* Título y Mensaje de confirmación (RF-AUTH-005) */}
              <Text className="text-center text-xl font-bold text-texto">
                Cerrar sesión
              </Text>
              <Text className="mt-2 text-center text-sm leading-relaxed text-texto-tenue">
                ¿Estás seguro de que deseas cerrar sesión?
              </Text>

              {/* Botones de acción: Cancelar y Confirmar */}
              <View className="mt-6 flex-row items-center gap-3">
                <View className="flex-1">
                  <Boton
                    testID="btn-cancelar-cierre-sesion"
                    titulo="Cancelar"
                    variante="secundario"
                    deshabilitado={cargando}
                    onPress={onCancelar}
                  />
                </View>
                <View className="flex-1">
                  <Boton
                    testID="btn-confirmar-cierre-sesion"
                    titulo="Confirmar"
                    variante="peligro"
                    cargando={cargando}
                    onPress={onConfirmar}
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
