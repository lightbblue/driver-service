import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { RolUsuario } from '@/types';

export type DatosRegistro = {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  rol: Extract<RolUsuario, 'cliente' | 'mecanico'>;
  /** Solo para mecánicos. */
  taller?: {
    nombre: string;
    /** Zona donde trabaja (ej: Pilar). Se guarda en `mecanicos.localidad`. */
    zona: string;
    especialidades: string[];
    descripcion: string;
    /** Solo si tiene taller: lo ubica en el mapa. Null si hace asistencia en ruta. */
    ubicacion: { latitud: number; longitud: number; direccion: string } | null;
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
 * Dirección a la que Google (vía Supabase) devuelve al usuario en el celular.
 * - En desarrollo, Expo Go solo se abre con `exp://<ip>:8081/--/`. `Linking.createURL`
 *   puede devolver `riderservice:///`, que en Expo Go no abre nada y deja el navegador cargando.
 * - En la app instalada se usa el esquema propio, `riderservice:///`.
 * Las dos están permitidas en Supabase (Redirect URLs: `exp://**` y `riderservice://**`).
 */
function urlDeVueltaGoogle(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (__DEV__ && hostUri) return `exp://${hostUri.replace(/\/$/, '')}/--/`;
  return Linking.createURL('/');
}

/**
 * Inicia sesión con Google mediante OAuth y PKCE (RF-AUTH-007).
 * La cuenta nueva queda con rol cliente: el trigger nunca crea un mecánico desde Google (RN-015).
 *
 * - Celular: abre Google en el navegador del sistema y, al volver, canjea el código por la sesión.
 *   Devuelve `false` si el usuario cerró el navegador sin elegir una cuenta.
 * - Web: redirige la página a Google; a la vuelta, supabase-js toma el código de la URL solo.
 */
export async function iniciarSesionConGoogle(): Promise<boolean> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error('No se pudo iniciar sesión con Google. Intentá nuevamente.');
    return true;
  }

  const redirectTo = urlDeVueltaGoogle();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    throw new Error('No se pudo iniciar sesión con Google. Intentá nuevamente.');
  }

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultado.type !== 'success') return false;

  const { queryParams } = Linking.parse(resultado.url);
  const codigo = queryParams?.code;
  if (typeof codigo !== 'string') {
    throw new Error('Google no devolvió la autorización. Intentá nuevamente.');
  }

  const { error: errorCanje } = await supabase.auth.exchangeCodeForSession(codigo);
  if (errorCanje) {
    throw new Error('No se pudo completar el inicio de sesión con Google.');
  }
  return true;
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
              taller_ubicacion: datos.taller.zona.trim(),
              taller_especialidades: datos.taller.especialidades,
              taller_descripcion: datos.taller.descripcion.trim(),
              ...(datos.taller.ubicacion
                ? {
                    taller_latitud: datos.taller.ubicacion.latitud,
                    taller_longitud: datos.taller.ubicacion.longitud,
                    taller_direccion: datos.taller.ubicacion.direccion.trim(),
                  }
                : {}),
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
