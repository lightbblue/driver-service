import { lanzar } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import type { Mecanico, TallerOpcion } from '@/types';

type Posicion = { latitud: number; longitud: number };

type TallerDB = {
  id: string;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  localidad: string | null;
  direccion: string;
  latitud: number;
  longitud: number;
  imagen_url: string | null;
  especialidades: string[] | null;
};

/** Mecánico que trabaja en ruta, sin taller. */
type MecanicoDB = {
  id: string;
  usuario_id: string | null;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  localidad: string | null;
  disponible: boolean;
  imagen_url: string | null;
  especialidades: string[] | null;
};

/** Fila de `resumen_talleres()`: reseñas del taller, sus mecánicos y las estrellas de ellos. */
type ResumenTaller = {
  taller_id: string;
  promedio: number | string | null;
  cantidad: number;
  mecanicos: number;
  disponibles: number;
  promedio_mecanicos?: number | string | null;
  calificaciones_mecanicos?: number;
};

/** Fila de `resumen_mecanicos()`: promedio de estrellas y servicios resueltos. */
type ResumenMecanico = {
  mecanico_id: string;
  promedio: number | string | null;
  cantidad: number;
  resueltas: number;
};

const aNumero = (valor: number | string | null | undefined): number | null =>
  valor == null ? null : Number(valor);

/** Calcula la distancia en kilómetros entre dos coordenadas geográficas (fórmula de Haversine). */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/** Indica si el prestador tiene ubicación en el mapa (solo los talleres la tienen). */
export function tieneUbicacion(mecanico: Mecanico): boolean {
  return mecanico.latitud !== 0 || mecanico.longitud !== 0;
}

/**
 * Talleres (con o sin mecánicos adheridos) y mecánicos que trabajan en ruta.
 * Un taller sin mecánicos con cuenta es "no adherido": solo se lo puede llamar.
 */
async function consultarPrestadores(posicionUsuario?: Posicion | null): Promise<Mecanico[]> {
  const [talleres, enRuta, resumenTalleres, resumenMecanicos] = await Promise.all([
    supabase
      .from('talleres')
      .select('id, nombre, descripcion, telefono, localidad, direccion, latitud, longitud, imagen_url, especialidades')
      .order('nombre'),
    supabase
      .from('mecanicos')
      .select('id, usuario_id, nombre, descripcion, telefono, localidad, disponible, imagen_url, especialidades')
      .is('taller_id', null)
      .order('nombre'),
    supabase.rpc('resumen_talleres'),
    supabase.rpc('resumen_mecanicos'),
  ]);

  if (talleres.error) throw new Error(`No se pudieron cargar los talleres: ${talleres.error.message}`);
  if (enRuta.error) throw new Error(`No se pudieron cargar los mecánicos: ${enRuta.error.message}`);

  // Si los resúmenes fallan, los prestadores se muestran igual, sin calificación.
  const porTaller = new Map(
    ((resumenTalleres.data ?? []) as ResumenTaller[]).map((fila) => [fila.taller_id, fila]),
  );
  const porMecanico = new Map(
    ((resumenMecanicos.data ?? []) as ResumenMecanico[]).map((fila) => [fila.mecanico_id, fila]),
  );

  const deTalleres: Mecanico[] = ((talleres.data ?? []) as TallerDB[]).map((taller) => {
    const resumen = porTaller.get(taller.id);
    return {
      id: taller.id,
      tipo: 'taller',
      adherido: (resumen?.mecanicos ?? 0) > 0,
      cantidad_mecanicos: resumen?.mecanicos ?? 0,
      calificacion_mecanicos: aNumero(resumen?.promedio_mecanicos),
      calificaciones_mecanicos: resumen?.calificaciones_mecanicos ?? 0,
      perfil_id: '',
      nombre_taller: taller.nombre,
      descripcion: taller.descripcion,
      logo_url: taller.imagen_url,
      direccion_taller: taller.direccion,
      localidad: taller.localidad ?? 'Localidad no indicada',
      telefono: taller.telefono,
      latitud: taller.latitud,
      longitud: taller.longitud,
      radio_cobertura_km: 0,
      atiende_a_domicilio: false,
      disponible: (resumen?.disponibles ?? 0) > 0,
      verificado: false,
      calificacion_promedio: aNumero(resumen?.promedio),
      cantidad_calificaciones: resumen?.cantidad ?? 0,
      servicios_completados: 0,
      especialidades: taller.especialidades ?? [],
      distancia_km: null,
      abierto_ahora: false,
    };
  });

  const deMecanicos: Mecanico[] = ((enRuta.data ?? []) as MecanicoDB[]).map((mecanico) => {
    const resumen = porMecanico.get(mecanico.id);
    return {
      id: mecanico.id,
      tipo: 'mecanico',
      adherido: mecanico.usuario_id != null,
      cantidad_mecanicos: 0,
      calificacion_mecanicos: null,
      calificaciones_mecanicos: 0,
      perfil_id: mecanico.usuario_id ?? '',
      nombre_taller: mecanico.nombre,
      descripcion: mecanico.descripcion,
      logo_url: mecanico.imagen_url,
      // Sin taller: no tiene dirección ni aparece en el mapa.
      direccion_taller: '',
      localidad: mecanico.localidad ?? 'Localidad no indicada',
      telefono: mecanico.telefono,
      latitud: 0,
      longitud: 0,
      radio_cobertura_km: 0,
      atiende_a_domicilio: true,
      disponible: mecanico.usuario_id != null && mecanico.disponible,
      verificado: false,
      calificacion_promedio: aNumero(resumen?.promedio),
      cantidad_calificaciones: resumen?.cantidad ?? 0,
      servicios_completados: resumen?.resueltas ?? 0,
      especialidades: mecanico.especialidades ?? [],
      distancia_km: null,
      abierto_ahora: false,
    };
  });

  const prestadores = [...deTalleres, ...deMecanicos];
  if (!posicionUsuario) return prestadores;

  // Con la posición del usuario se calcula la distancia y se ordena del más cercano al más lejano.
  return prestadores
    .map((prestador) =>
      tieneUbicacion(prestador)
        ? {
            ...prestador,
            distancia_km: calcularDistanciaKm(
              posicionUsuario.latitud,
              posicionUsuario.longitud,
              prestador.latitud,
              prestador.longitud,
            ),
          }
        : prestador,
    )
    .sort((a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity));
}

/** Talleres y mecánicos en ruta (con la distancia si se pasa la posición del usuario). */
export async function listarMecanicos(posicionUsuario?: Posicion | null): Promise<Mecanico[]> {
  return consultarPrestadores(posicionUsuario);
}

/** Radio de "cerca tuyo" para los destacados del inicio. */
const RADIO_DESTACADOS_KM = 25;

/**
 * Talleres destacados del inicio: los cercanos mejor calificados.
 * Orden: más estrellas primero (sin calificar al final), y a igual puntaje, el más cercano.
 * Sin la posición del usuario se ordenan solo por calificación.
 */
export async function listarTalleresDestacados(
  posicionUsuario: Posicion | null,
  limite = 6,
): Promise<Mecanico[]> {
  const talleres = (await consultarPrestadores(posicionUsuario)).filter((p) => p.tipo === 'taller');
  const cercanos = posicionUsuario
    ? talleres.filter((t) => t.distancia_km != null && t.distancia_km <= RADIO_DESTACADOS_KM)
    : talleres;

  return (cercanos.length > 0 ? cercanos : talleres)
    .sort(
      (a, b) =>
        (b.calificacion_promedio ?? -1) - (a.calificacion_promedio ?? -1) ||
        b.cantidad_calificaciones - a.cantidad_calificaciones ||
        (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity),
    )
    .slice(0, limite);
}

/** Busca un taller o un mecánico en ruta por su id. */
export async function obtenerMecanico(id: string | null): Promise<Mecanico | null> {
  if (!id) return null;
  const prestadores = await consultarPrestadores();
  return prestadores.find((prestador) => prestador.id === id) ?? null;
}

/**
 * Foto y estrellas del mecánico que atiende al cliente, para que decida si sigue con él.
 * Si algo falla, la tarjeta se muestra igual sin esos datos.
 */
export async function obtenerFichaMecanico(
  mecanicoId: string,
): Promise<{ promedio: number | null; cantidad: number; fotoUrl: string | null }> {
  const [resumen, foto] = await Promise.all([
    supabase.rpc('resumen_mecanicos'),
    supabase.rpc('foto_mecanico_asignado', { p_mecanico_id: mecanicoId }),
  ]);
  const fila = ((resumen.data ?? []) as ResumenMecanico[]).find((r) => r.mecanico_id === mecanicoId);
  return {
    promedio: aNumero(fila?.promedio),
    cantidad: fila?.cantidad ?? 0,
    fotoUrl: typeof foto.data === 'string' && foto.data ? foto.data : null,
  };
}

/** Especialidades que se pueden elegir (catálogo fijo; se leen sin sesión para el registro). */
export async function listarEspecialidades(): Promise<string[]> {
  const { data, error } = await supabase.from('especialidades').select('nombre').order('orden').order('nombre');
  if (error) lanzar(error, 'No se pudieron cargar las especialidades');
  return ((data ?? []) as { nombre: string }[]).map((e) => e.nombre);
}

/** Talleres a los que se puede sumar un mecánico al registrarse (se leen sin sesión). */
export async function listarTalleres(): Promise<TallerOpcion[]> {
  const { data, error } = await supabase.from('talleres').select('id, nombre, direccion').order('nombre');
  if (error) lanzar(error, 'No se pudieron cargar los talleres');
  return (data ?? []) as TallerOpcion[];
}

/** Disponibilidad del mecánico autenticado, o null si no es mecánico (RF-PROF-003). */
export async function obtenerDisponibilidad(): Promise<boolean | null> {
  const { data: sesion } = await supabase.auth.getSession();
  const usuarioId = sesion.session?.user.id;
  if (!usuarioId) return null;

  const { data, error } = await supabase
    .from('mecanicos')
    .select('disponible')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) lanzar(error, 'No se pudo consultar tu disponibilidad');
  return data ? Boolean((data as { disponible: boolean }).disponible) : null;
}

/** Activa o desactiva al mecánico. Sin disponibilidad no ve ni acepta solicitudes nuevas (RN-003). */
export async function cambiarDisponibilidad(disponible: boolean): Promise<void> {
  const { error } = await supabase.rpc('cambiar_disponibilidad', { p_disponible: disponible });
  if (error) lanzar(error, 'No se pudo cambiar tu disponibilidad');
}
