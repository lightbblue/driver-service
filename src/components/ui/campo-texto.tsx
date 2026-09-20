import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

type CampoTextoProps = TextInputProps & {
  etiqueta?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  /** Muestra el control de visibilidad de contraseña (comportamiento visual del control). */
  esContrasenia?: boolean;
  className?: string;
};

/**
 * Campo de formulario del sistema de diseño.
 * No valida ni transforma el contenido: la validación es Entrega 2 (RF-AUTH-009).
 */
export function CampoTexto({
  etiqueta,
  icono,
  esContrasenia = false,
  className,
  multiline,
  ...rest
}: CampoTextoProps) {
  const [visible, setVisible] = useState(false);
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View className={cn('gap-2', className)}>
      {etiqueta ? <Text className="text-sm font-semibold text-texto">{etiqueta}</Text> : null}

      <View
        className={cn(
          'flex-row rounded-campo border bg-superficie px-4',
          multiline ? 'items-start py-3' : 'min-h-[52px] items-center',
          enfocado ? 'border-acento' : 'border-borde',
        )}>
        {icono ? (
          <View className={cn('mr-3', multiline && 'mt-1')}>
            <Ionicons name={icono} size={18} color={enfocado ? '#FFC107' : '#6B7280'} />
          </View>
        ) : null}

        <TextInput
          className={cn('flex-1 text-base text-texto', multiline && 'min-h-[96px]')}
          placeholderTextColor="#6B7280"
          secureTextEntry={esContrasenia && !visible}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          {...rest}
        />

        {esContrasenia ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={12}
            onPress={() => setVisible((v) => !v)}
            className="ml-2 active:opacity-60">
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
