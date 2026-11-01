import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { iniciarSesionConGoogle } from '@/services';

/**
 * Lógica del botón "Continuar con Google", compartida por el login y el registro.
 * Si el usuario cancela, no pasa nada (vuelve a la pantalla sin error).
 */
export function useLoginGoogle(onError: (mensaje: string) => void) {
  const router = useRouter();
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  const entrarConGoogle = async () => {
    if (cargandoGoogle) return;
    setCargandoGoogle(true);
    try {
      const entro = await iniciarSesionConGoogle();
      // En la web la página ya se fue a Google; el Inicio se abre a la vuelta.
      if (entro && Platform.OS !== 'web') router.replace('/inicio');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.');
    } finally {
      setCargandoGoogle(false);
    }
  };

  return { entrarConGoogle, cargandoGoogle };
}
