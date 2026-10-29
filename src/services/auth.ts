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
    ubicacion: string;
    especialidades: string[];
    descripcion: string;
  };
};

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
