import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { escucharSesion } from '@/services';

/** Sesión de Supabase guardada en el dispositivo; `cargando` hasta leerla. */
export function useSesion(): { sesion: Session | null; cargando: boolean } {
  const [estado, setEstado] = useState<{ sesion: Session | null; cargando: boolean }>({
    sesion: null,
    cargando: true,
  });

  useEffect(() => escucharSesion((sesion) => setEstado({ sesion, cargando: false })), []);

  return estado;
}
