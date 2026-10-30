
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Boton, CampoTexto, Pantalla } from '@/components/ui';
import { useRecurso } from '@/hooks/use-recurso';
import { actualizarPerfil, obtenerUsuarioActual } from '@/services';
import type { Perfil } from '@/types';

export default function EditarPerfilScreen() {
  const router = useRouter();

  const { datos: usuario, cargando } = useRecurso<Perfil | null>(
    obtenerUsuarioActual,
    null,
  );

  const [nombreEditado, setNombreEditado] = useState<string | null>(null);
  const [telefonoEditado, setTelefonoEditado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreInicial =
    usuario?.nombre_completo === 'Sin nombre'
      ? ''
      : usuario?.nombre_completo ?? '';
  const telefonoInicial = usuario?.telefono ?? '';

  const nombre = nombreEditado ?? nombreInicial;
  const telefono = telefonoEditado ?? telefonoInicial;

  async function guardar() {
    if (guardando) return;

    if (!usuario) {
      Alert.alert(
        'Perfil no disponible',
        'Iniciá sesión e intentá nuevamente.',
      );
      return;
    }

    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Ingresá tu nombre para continuar.');
      return;
    }

    setGuardando(true);

    try {
      await actualizarPerfil({ nombre, telefono });

      Alert.alert(
        'Perfil actualizado',
        'Tus datos se guardaron correctamente.',
        [{ text: 'Aceptar', onPress: () => router.back() }],
      );
    } catch (error) {
      Alert.alert(
        'No se pudieron guardar los cambios',
        error instanceof Error
          ? error.message
          : 'Intentá nuevamente más tarde.',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-5 px-4 py-6">
        <Text className="text-2xl font-extrabold text-texto">
          Editar perfil
        </Text>

        <Text className="text-sm text-texto-tenue">
          Actualizá tus datos personales. El correo y el tipo de cuenta no se
          modifican desde esta pantalla.
        </Text>

        {cargando ? (
          <Text className="text-texto-tenue">Cargando perfil...</Text>
        ) : usuario ? (
          <View className="gap-4">
            <CampoTexto
              etiqueta="Nombre completo *"
              icono="person-outline"
              value={nombre}
              onChangeText={setNombreEditado}
              placeholder="Ingresá tu nombre"
              autoCapitalize="words"
              maxLength={100}
              editable={!guardando}
              accessibilityLabel="Nombre completo"
            />

            <CampoTexto
              etiqueta="Teléfono"
              icono="call-outline"
              value={telefono}
              onChangeText={setTelefonoEditado}
              placeholder="Ingresá tu teléfono"
              keyboardType="phone-pad"
              maxLength={30}
              editable={!guardando}
              accessibilityLabel="Teléfono"
            />

            <CampoTexto
              etiqueta="Correo electrónico"
              icono="mail-outline"
              value={usuario.email}
              editable={false}
              accessibilityLabel="Correo electrónico, no editable"
            />

            <Boton
              titulo={guardando ? 'Guardando...' : 'Guardar cambios'}
              onPress={guardar}
              className="mt-2"
            />

            <Boton
              titulo="Cancelar"
              variante="fantasma"
              onPress={() => router.back()}
            />
          </View>
        ) : (
          <Text className="text-texto-tenue">
            No encontramos un perfil para tu sesión. Volvé a iniciar sesión e
            intentá nuevamente.
          </Text>
        )}
      </ScrollView>
    </Pantalla>
  );
}
