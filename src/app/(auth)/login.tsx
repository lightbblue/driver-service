import { Link, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import {
  Boton,
  BotonGoogle,
  CampoTexto,
  Distintivos,
  FondoMarca,
  LogoRider,
  Pantalla,
  SeparadorO,
} from '@/components/ui';

/**
 * Pantalla de inicio de sesión (RF-VIEW-002).
 *
 * Fuera de alcance por decisión documentada: validación de formato, verificación
 * de credenciales, mensajes de error y creación de sesión (RF-AUTH-002, E2).
 * El botón principal navega al Inicio sin verificar nada.
 */
export default function LoginScreen() {
  const router = useRouter();

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante="ruta" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow justify-center gap-6 px-6 py-8">
          <View className="items-center">
            <LogoRider tamanio="grande" />
          </View>

          <View className="gap-1">
            <Text className="text-center text-4xl font-extrabold text-texto">Iniciar sesión</Text>
            <Text className="text-center text-sm text-texto-tenue">
              Ingresá a tu cuenta para continuar
            </Text>
          </View>

          <View className="gap-4">
            <CampoTexto
              testID="campo-email"
              etiqueta="Correo electrónico"
              icono="mail-outline"
              placeholder="ejemplo@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <View className="gap-2">
              <CampoTexto
                testID="campo-password"
                etiqueta="Contraseña"
                icono="lock-closed-outline"
                placeholder="Tu contraseña"
                esContrasenia
                autoCapitalize="none"
              />
              {/* Control inerte: depende del backend de correo (RF-AUTH-008) */}
              <Pressable
                testID="btn-recuperar"
                accessibilityRole="button"
                accessibilityLabel="¿Olvidaste tu contraseña?"
                hitSlop={8}
                className="self-end active:opacity-60">
                <Text className="text-chico font-semibold text-acento">
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-4">
            <Boton
              testID="btn-iniciar-sesion"
              titulo="Iniciar sesión"
              iconoDerecha="arrow-forward"
              onPress={() => router.replace('/inicio')}
            />
            <SeparadorO />
            <BotonGoogle />
          </View>

          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-sm text-texto-tenue">¿No tenés cuenta?</Text>
            <Link href="/register" asChild>
              <Pressable testID="link-registro" accessibilityRole="link" hitSlop={8} className="active:opacity-60">
                <Text className="text-sm font-bold text-acento">Registrate</Text>
              </Pressable>
            </Link>
          </View>

          <Distintivos />
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  );
}
