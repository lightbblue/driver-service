import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

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
  SubirImagenes,
  type OpcionConmutador,
} from '@/components/ui';
import { COLORES } from '@/lib/tema';
import { registrarCuenta } from '@/services';

type Variante = 'usuario' | 'mecanico';

const OPCIONES: OpcionConmutador<Variante>[] = [
  { valor: 'usuario', etiqueta: 'Usuario', icono: 'person-outline' },
  { valor: 'mecanico', etiqueta: 'Mecánico', icono: 'construct-outline' },
];

const TEXTOS: Record<Variante, { titulo: string; bajada: string; boton: string }> = {
  usuario: {
    titulo: 'Creá tu cuenta',
    bajada: 'Unite a Rider Service y formá parte de nuestra comunidad.',
    boton: 'Crear cuenta',
  },
  mecanico: {
    titulo: 'Sumate como mecánico',
    bajada: 'Ofrecé tu servicio, ayudá en el camino y sé parte de la comunidad Rider Service.',
    boton: 'Crear cuenta como mecánico',
  },
};

/** Registro de cuenta con sus dos variantes, Usuario y Mecánico (RF-VIEW-003, RF-AUTH-003/004). */
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

  // Campos propios del mecánico
  const [taller, setTaller] = useState('');
  const [ubicacionTaller, setUbicacionTaller] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const esMecanico = variante === 'mecanico';
  const textos = TEXTOS[variante];

  function validar(): string | null {
    if (!nombre.trim() || !email.trim() || !telefono.trim() || !password || !confirmacion) {
      return 'Completá todos los campos obligatorios para continuar.';
    }
    if (esMecanico && !ubicacionTaller.trim()) {
      return 'Indicá la ubicación de tu taller para que los clientes puedan encontrarte.';
    }
    if (password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (password !== confirmacion) {
      return 'Las contraseñas no coinciden.';
    }
    if (!aceptaTerminos) {
      return 'Tenés que aceptar los términos y condiciones para continuar.';
    }
    return null;
  }

  async function registrar() {
    const problema = validar();
    if (problema) {
      Alert.alert('Revisá los datos', problema);
      return;
    }

    setCargando(true);
    try {
      const { requiereConfirmacion } = await registrarCuenta({
        nombre,
        email,
        telefono,
        password,
        rol: esMecanico ? 'mecanico' : 'cliente',
        taller: esMecanico
          ? {
              nombre: taller,
              ubicacion: ubicacionTaller,
              especialidades: especialidades
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean),
              descripcion,
            }
          : undefined,
      });

      router.replace('/login');
      setTimeout(() => {
        Alert.alert(
          '¡Cuenta creada!',
          requiereConfirmacion
            ? 'Revisá tu correo para confirmar la cuenta y después iniciá sesión.'
            : 'Ya podés iniciar sesión con tu correo y contraseña.',
        );
      }, 300);
    } catch (motivo) {
      Alert.alert(
        'No se pudo crear la cuenta',
        motivo instanceof Error ? motivo.message : 'Revisá tu conexión e intentá nuevamente.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante={esMecanico ? 'taller' : 'montania'} />

      {/* Fijo fuera del scroll: siempre se puede volver, sin importar el formulario. */}
      <View className="flex-row items-center px-6 pb-1 pt-2">
        <Pressable
          testID="btn-volver"
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-superficie">
          <Ionicons name="chevron-back" size={24} color={COLORES.texto} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-bold text-texto">Registro</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-6 pb-10 pt-2">
          <View className="items-center">
            <LogoRider tamanio="mediano" />
          </View>

          <View className="gap-1">
            <Text className="text-center text-3xl font-extrabold text-texto">{textos.titulo}</Text>
            <Text className="text-center text-sm text-texto-tenue">{textos.bajada}</Text>
          </View>

          <Conmutador opciones={OPCIONES} valor={variante} onCambio={setVariante} />

          <View className="gap-4">
            <CampoTexto
              testID="campo-nombre"
              etiqueta="Nombre completo"
              icono="person-outline"
              placeholder="Tu nombre y apellido"
              autoComplete="name"
              value={nombre}
              onChangeText={setNombre}
            />
            <CampoTexto
              testID="campo-email"
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
              testID="campo-telefono"
              etiqueta="Número de teléfono"
              icono="call-outline"
              placeholder="+54 11 1234 5678"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            {esMecanico ? (
              <>
                <CampoTexto
                  testID="campo-taller"
                  etiqueta="Nombre del taller (opcional)"
                  icono="storefront-outline"
                  placeholder="Nombre de tu taller"
                  value={taller}
                  onChangeText={setTaller}
                />
                <CampoTexto
                  testID="campo-ubicacion-taller"
                  etiqueta="Ubicación del taller"
                  icono="location-outline"
                  placeholder="Dirección o localidad"
                  value={ubicacionTaller}
                  onChangeText={setUbicacionTaller}
                />
                <CampoTexto
                  testID="campo-especialidades"
                  etiqueta="Especialidades"
                  icono="build-outline"
                  placeholder="Ej: Motos, eléctricos, emergencias"
                  value={especialidades}
                  onChangeText={setEspecialidades}
                />
                <CampoTexto
                  testID="campo-descripcion"
                  etiqueta="Descripción (opcional)"
                  icono="document-text-outline"
                  placeholder="Contanos sobre tus servicios…"
                  multiline
                  value={descripcion}
                  onChangeText={setDescripcion}
                />
                <SubirImagenes />
              </>
            ) : null}

            <CampoTexto
              testID="campo-password"
              etiqueta="Contraseña"
              icono="lock-closed-outline"
              placeholder="Mínimo 6 caracteres"
              esContrasenia
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <CampoTexto
              testID="campo-password-confirmacion"
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
            testID="casilla-terminos"
            accessibilityLabel="Acepto los términos y condiciones"
            checked={aceptaTerminos}
            onChange={setAceptaTerminos}>
            <Text className="text-chico leading-[17px] text-texto-tenue">
              Acepto los <Text className="font-bold text-acento">Términos y Condiciones</Text> y la{' '}
              <Text className="font-bold text-acento">Política de Privacidad</Text>
            </Text>
          </Casilla>

          <View className="gap-4">
            <Boton
              testID="btn-crear-cuenta"
              titulo={textos.boton}
              iconoDerecha="arrow-forward"
              onPress={registrar}
              cargando={cargando}
              deshabilitado={cargando}
            />
            <SeparadorO />
            <BotonGoogle />
          </View>

          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-sm text-texto-tenue">¿Ya tenés una cuenta?</Text>
            <Link href="/login" asChild>
              <Pressable testID="link-login" accessibilityRole="link" hitSlop={8} className="active:opacity-60">
                <Text className="text-sm font-bold text-acento">Iniciar sesión</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Pantalla>
  );
}
