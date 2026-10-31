import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';
import type { RolUsuario } from '@/types';

// Completa la sesión web en caso de redirección en navegador (RF-AUTH-007)
WebBrowser.maybeCompleteAuthSession();

export type DatosRegistro = {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  rol: Extract<RolUsuario, 'cliente' | 'mecanico'>;
  /** Solo para mecánicos. */
  taller?: {
    nombre: string;
    ubicacion: string;
    especialidades: string[];
    descripcion: string;
  };
};

/** Inicia sesión con correo y contraseña. Los errores llegan con un mensaje para mostrar. */
export async function iniciarSesion(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    const mensaje = error.message.toLowerCase();
    if (mensaje.includes('email not confirmed')) {
      throw new Error('Tu correo todavía no está confirmado. Revisá tu email.');
    }
    if (mensaje.includes('invalid login credentials')) {
      throw new Error('El correo o la contraseña son incorrectos.');
    }
    throw new Error('No se pudo iniciar sesión. Revisá los datos e intentá nuevamente.');
  }

  if (!data.session) {
    throw new Error('No se pudo iniciar la sesión. Intentá nuevamente.');
  }
}

/**
 * Inicia sesión con Google mediante OAuth 2.0 PKCE en Supabase Auth (RF-AUTH-007).
 * Abre el navegador del sistema con expo-web-browser.
 * Devuelve true si la sesión se inició, o false si el usuario canceló (CP-GOO-04).
 */
export async function iniciarSesionConGoogle(): Promise<boolean> {
  const redirectUrl = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    const msg = error.message || 'No se pudo iniciar el flujo con Google.';
    if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
      throw new Error('El proveedor de Google no está activado en el panel de Supabase.');
    }
    if (msg.toLowerCase().includes('redirect url') || msg.toLowerCase().includes('not allowed')) {
      throw new Error(`La URL de retorno no está habilitada en Supabase: ${redirectUrl}`);
    }
    throw new Error(msg);
  }

  if (!data?.url) {
    throw new Error('No se recibió la dirección de autenticación de Google.');
  }

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (resultado.type === 'success' && resultado.url) {
    const parseado = Linking.parse(resultado.url);

    // Revisar si Supabase devolvió error en los parámetros de la URL
    const errorParam =
      parseado.queryParams?.error_description ||
      parseado.queryParams?.error ||
      parseado.queryParams?.msg;

    if (errorParam) {
      const errTexto = String(errorParam);
      if (errTexto.toLowerCase().includes('redirect') || errTexto.toLowerCase().includes('not allowed')) {
        throw new Error(
          `URL de redirección no permitida en Supabase. Se requiere configurar exp://** en el panel.`,
        );
      }
      throw new Error(errTexto);
    }

    const code = parseado.queryParams?.code;
    const authCode = typeof code === 'string' ? code : Array.isArray(code) ? code[0] : null;

    if (authCode) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
      if (exchangeError) {
        throw new Error(exchangeError.message || 'No se pudo validar la sesión de Google.');
      }
      return true;
    }

    // Soporte para retorno por fragmento de URL (#access_token=...)
    const hash = resultado.url.split('#')[1];
    if (hash) {
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          throw new Error(sessionError.message || 'No se pudo guardar la sesión de Google.');
        }
        return true;
      }
    }

    return true;
  }

  // CP-GOO-04: Si el usuario cancela o cierra la ventana, vuelve al login sin error
  return false;
}

/**
 * Crea la cuenta en Supabase Auth. Los datos del perfil viajan como metadatos y
 * la base los copia a `perfiles` (y a `mecanicos` si el rol es mecánico) con un trigger.
 * Deja la sesión cerrada: el usuario entra después desde el login.
 */
export async function registrarCuenta(datos: DatosRegistro): Promise<{ requiereConfirmacion: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    options: {
      data: {
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        rol: datos.rol,
        ...(datos.taller
          ? {
              taller_nombre: datos.taller.nombre.trim(),
              taller_ubicacion: datos.taller.ubicacion.trim(),
              taller_especialidades: datos.taller.especialidades,
              taller_descripcion: datos.taller.descripcion.trim(),
            }
          : {}),
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.session) {
    return { requiereConfirmacion: true };
  }

  await supabase.auth.signOut();
  return { requiereConfirmacion: false };
}
