
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

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
import { useLoginGoogle } from '@/hooks/use-login-google';
import { iniciarSesion as autenticar } from '@/services';

export default function LoginScreen() {
  const router = useRouter();

  const [correo, setCorreo] = useState('');
  const [contrasenia, setContrasenia] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState('');
  const { entrarConGoogle, cargandoGoogle } = useLoginGoogle(setErrorMensaje);

  const iniciarSesion = async () => {
    if (cargando) return;

    setErrorMensaje('');

    if (!correo.trim() || !contrasenia) {
      setErrorMensaje('Ingresá tu correo electrónico y contraseña.');
      return;
    }

    setCargando(true);

    try {
      await autenticar(correo, contrasenia);
      router.replace('/inicio');
    } catch (error) {
      setErrorMensaje(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión. Intentá nuevamente.',
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante="ruta" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow justify-center gap-6 px-6 py-8"
        >
          <View className="items-center">
            <LogoRider tamanio="grande" />
          </View>

          <View className="gap-1">
            <Text className="text-center text-4xl font-extrabold text-texto">
              Iniciar sesión
            </Text>
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
              value={correo}
              onChangeText={setCorreo}
              editable={!cargando}
            />

            <CampoTexto
              testID="campo-password"
              etiqueta="Contraseña"
              icono="lock-closed-outline"
              placeholder="Tu contraseña"
              esContrasenia
              autoCapitalize="none"
              value={contrasenia}
              onChangeText={setContrasenia}
              editable={!cargando}
            />
          </View>

          {errorMensaje ? (
            <View className="rounded-xl bg-red-100 p-3">
              <Text className="text-sm text-red-800">
                {errorMensaje}
              </Text>
            </View>
          ) : null}

          <View className="gap-4">
            <Boton
              testID="btn-iniciar-sesion"
              titulo={cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
              iconoDerecha="arrow-forward"
              cargando={cargando}
              deshabilitado={cargando}
              onPress={iniciarSesion}
            />

            <SeparadorO />

            <BotonGoogle
              onPress={() => {
                setErrorMensaje('');
                void entrarConGoogle();
              }}
              cargando={cargandoGoogle}
            />
          </View>

          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-sm text-texto-tenue">
              ¿No tenés cuenta?
            </Text>

            <Link href="/register" asChild>
              <Pressable
                testID="link-registro"
                accessibilityRole="link"
                hitSlop={8}
                className="active:opacity-60"
              >
                <Text className="text-sm font-bold text-acento">
                  Registrate
                </Text>
              </Pressable>
            </Link>
          </View>

          <Distintivos />
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  );
}
