
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
  Casilla,
  Conmutador,
  FondoMarca,
  LogoRider,
  Pantalla,
  SeparadorO,
  type OpcionConmutador,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';

type Variante = 'usuario' | 'mecanico';

const OPCIONES: OpcionConmutador<Variante>[] = [
  { valor: 'usuario', etiqueta: 'Usuario', icono: 'person-outline' },
  { valor: 'mecanico', etiqueta: 'Mecánico', icono: 'construct-outline' },
];

export default function RegisterScreen() {
  const router = useRouter();

  const [variante, setVariante] = useState<Variante>('usuario');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);

  const esMecanico = variante === 'mecanico';

  async function registrar() {
    if (esMecanico) {
      Alert.alert(
        'Registro de mecánicos',
        'El registro de mecánicos todavía no está habilitado. Por ahora podés crear una cuenta de usuario.'
      );
      return;
    }

    const correo = email.trim().toLowerCase();

    if (!nombre.trim() || !correo || !telefono.trim() || !password || !confirmacion) {
      Alert.alert('Faltan datos', 'Completá todos los campos para continuar.');
      return;
    }

    if (!aceptaTerminos) {
      Alert.alert(
        'Términos y condiciones',
        'Tenés que aceptar los términos y condiciones para continuar.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert('Contraseña inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmacion) {
      Alert.alert('Las contraseñas no coinciden', 'Revisá ambas contraseñas e intentá nuevamente.');
      return;
    }

    setCargando(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            telefono: telefono.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('No se pudo crear la cuenta', error.message);
        return;
      }

      if (!data.session) {
        router.replace('/login');
        setTimeout(() => {
          Alert.alert(
            '¡Registro exitoso!',
            'Tu cuenta fue creada. Revisá tu correo para confirmar la cuenta y después iniciá sesión.'
          );
        }, 300);
        return;
      }

      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) {
        Alert.alert(
          'Cuenta creada',
          'Tu cuenta se creó, pero no pudimos cerrar la sesión automáticamente. Podés continuar desde el inicio de sesión.'
        );
      }

      router.replace('/login');
    } catch {
      Alert.alert(
        'Error de conexión',
        'No pudimos conectarnos con el servidor. Revisá tu conexión a internet e intentá nuevamente.'
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante="montania" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-6 pb-10 pt-2">
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              hitSlop={10}
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-superficie">
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>

            <Text className="flex-1 text-center text-lg font-bold text-texto">
              Registro
            </Text>

            <View className="w-10" />
          </View>

          <View className="items-center">
            <LogoRider tamanio="mediano" />
          </View>

          <View className="gap-1">
            <Text className="text-center text-3xl font-extrabold text-texto">
              Creá tu cuenta
            </Text>
            <Text className="text-center text-sm text-texto-tenue">
              Unite a Rider Service y formá parte de nuestra comunidad.
            </Text>
          </View>

          <Conmutador
            opciones={OPCIONES}
            valor={variante}
            onCambio={setVariante}
          />

          <View className="gap-4">
            <CampoTexto
              etiqueta="Nombre completo"
              icono="person-outline"
              placeholder="Tu nombre y apellido"
              autoComplete="name"
              value={nombre}
              onChangeText={setNombre}
            />

            <CampoTexto
              etiqueta="Correo electrónico"
              icono="mail-outline"
              placeholder="ejemplo@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <CampoTexto
              etiqueta="Número de teléfono"
              icono="call-outline"
              placeholder="+54 11 1234 5678"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            <CampoTexto
              etiqueta="Contraseña"
              icono="lock-closed-outline"
              placeholder="Mínimo 6 caracteres"
              esContrasenia
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />

            <CampoTexto
              etiqueta="Confirmar contraseña"
              icono="lock-closed-outline"
              placeholder="Repetí tu contraseña"
              esContrasenia
              autoCapitalize="none"
              value={confirmacion}
              onChangeText={setConfirmacion}
            />
          </View>

          
<Casilla
  accessibilityLabel="Acepto los términos y condiciones"
  checked={aceptaTerminos}
  onChange={setAceptaTerminos}
>
  <Text className="text-chico leading-[17px] text-texto-tenue">
    Acepto los{' '}
    <Text className="font-bold text-acento">Términos y Condiciones</Text>
    {' '}y la{' '}
    <Text className="font-bold text-acento">Política de Privacidad</Text>
  </Text>
</Casilla>

          <View className="gap-4">
            <Boton
              titulo="Crear cuenta"
              iconoDerecha="arrow-forward"
              onPress={registrar}
              cargando={cargando}
              deshabilitado={cargando}
            />

            <SeparadorO />

            <BotonGoogle />
          </View>

          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-sm text-texto-tenue">
              ¿Ya tenés una cuenta?
            </Text>

            <Link href="/login" asChild>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                className="active:opacity-60">
                <Text className="text-sm font-bold text-acento">
                  Iniciar sesión
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  );
}
