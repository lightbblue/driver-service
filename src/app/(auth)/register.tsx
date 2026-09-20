import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

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

/**
 * Pantalla de registro con sus dos variantes (RF-VIEW-003).
 *
 * Fuera de alcance por decisión documentada: validación de campos obligatorios,
 * coincidencia de contraseñas, bloqueo del botón sin aceptar los términos,
 * alta de cuenta y carga de imágenes (RF-AUTH-003/004, E2).
 */
export default function RegisterScreen() {
  const router = useRouter();
  const [variante, setVariante] = useState<Variante>('usuario');
  const esMecanico = variante === 'mecanico';
  const textos = TEXTOS[variante];

  return (
    <Pantalla bordes={['top', 'bottom']}>
      <FondoMarca variante={esMecanico ? 'taller' : 'montania'} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-6 pb-10 pt-2">
          <View className="flex-row items-center">
            <Pressable
              testID="btn-volver"
              accessibilityRole="button"
              accessibilityLabel="Volver"
              hitSlop={10}
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-superficie">
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <Text className="flex-1 text-center text-lg font-bold text-texto">Registro</Text>
            <View className="w-10" />
          </View>

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
            />
            <CampoTexto
              testID="campo-email"
              etiqueta="Correo electrónico"
              icono="mail-outline"
              placeholder="ejemplo@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <CampoTexto
              testID="campo-telefono"
              etiqueta="Número de teléfono"
              icono="call-outline"
              placeholder="+54 11 1234 5678"
              keyboardType="phone-pad"
            />

            {esMecanico ? (
              <>
                <CampoTexto
                  testID="campo-taller"
                  etiqueta="Nombre del taller (opcional)"
                  icono="storefront-outline"
                  placeholder="Nombre de tu taller"
                />
                <CampoTexto
                  testID="campo-ubicacion-taller"
                  etiqueta="Ubicación del taller"
                  icono="location-outline"
                  placeholder="Dirección o localidad"
                />
                <CampoTexto
                  testID="campo-especialidades"
                  etiqueta="Especialidades"
                  icono="build-outline"
                  placeholder="Ej: Motos, eléctricos, emergencias, etc."
                />
                <CampoTexto
                  testID="campo-descripcion"
                  etiqueta="Descripción (opcional)"
                  icono="document-text-outline"
                  placeholder="Contanos sobre tus servicios…"
                  multiline
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
            />
            <CampoTexto
              testID="campo-password-confirmacion"
              etiqueta="Confirmar contraseña"
              icono="lock-closed-outline"
              placeholder="Repetí tu contraseña"
              esContrasenia
              autoCapitalize="none"
            />
          </View>

          <Casilla testID="casilla-terminos" accessibilityLabel="Acepto los términos y condiciones">
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
              onPress={() => router.replace('/inicio')}
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
