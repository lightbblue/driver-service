import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Falta configurar las variables de Supabase en .env');
}

const esWeb = Platform.OS === 'web';

/** Durante el renderizado estático de la web no hay `window` ni almacenamiento. */
const hayAlmacenamiento = !esWeb || typeof window !== 'undefined';

/**
 * Cliente único de Supabase.
 *
 * En el celular la sesión se guarda en AsyncStorage para que sobreviva al
 * cierre de la app; en la web, supabase-js usa `localStorage` por defecto.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // PKCE: Google devuelve un código que se canjea por la sesión (RF-AUTH-007).
    flowType: 'pkce',
    storage: esWeb ? undefined : AsyncStorage,
    persistSession: hayAlmacenamiento,
    autoRefreshToken: hayAlmacenamiento,
    detectSessionInUrl: esWeb,
  },
});

// En el celular el token solo se renueva mientras la app está en primer plano.
if (!esWeb) {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
