/**
 * Entidades del dominio de Rider Service.
 *
 * Reflejan las tablas del modelo de datos (documento 03) para que la migración
 * de JSON a Supabase no obligue a reescribir componentes (RNF-SCAL-001).
 * Los campos marcados como "derivado" no son columnas: en la Entrega 2 los
 * resuelve una función o una vista, y la capa de servicios los sigue exponiendo igual.
 */

export type RolUsuario = 'cliente' | 'mecanico' | 'admin';

export type EstadoServicio =
  | 'solicitado'
  | 'aceptado'
  | 'en_camino'
  | 'llegue'
  | 'trabajando'
  | 'finalizado'
  | 'cancelada';

/** Estadísticas del perfil. Derivadas: en E2 salen de una vista agregada. */
export interface EstadisticasPerfil {
  solicitudes: number;
  resueltas: number;
  calificacion: number | null;
  miembro_desde: number;
}

/** Tabla `perfiles`. */
export interface Perfil {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  rol: RolUsuario;
  avatar_url: string | null;
  localidad: string | null;
  provincia: string | null;
  creado_en: string;
  estadisticas: EstadisticasPerfil;
}

/** Tabla `mecanicos` + `mecanico_especialidades`. */
export interface Mecanico {
  id: string;
  perfil_id: string;
  nombre_taller: string;
  descripcion: string | null;
  logo_url: string | null;
  direccion_taller: string;
  localidad: string;
  latitud: number;
  longitud: number;
  radio_cobertura_km: number;
  atiende_a_domicilio: boolean;
  disponible: boolean;
  verificado: boolean;
  calificacion_promedio: number | null;
  cantidad_calificaciones: number;
  servicios_completados: number;
  /** Normalizado en `mecanico_especialidades` en E2. */
  especialidades: string[];
  /** Derivado: lo calcula `mecanicos_cercanos()` en E2. */
  distancia_km: number | null;
  /** Derivado del horario del taller en E2. */
  abierto_ahora: boolean;
}

/** Tabla `categorias_averia`. */
export interface CategoriaAveria {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono: string;
  requiere_foto: boolean;
  activo: boolean;
  orden: number;
}

/** Objeto anidado que en E2 se aplana en columnas de `servicios`. */
export interface UbicacionServicio {
  latitud: number;
  longitud: number;
  direccion: string;
  localidad: string | null;
  referencia: string | null;
}

/** Fila de `servicio_estados`. */
export interface HitoServicio {
  estado_nuevo: EstadoServicio;
  ocurrido_en: string | null;
  observacion: string | null;
}

/** Tabla `servicios`. */
export interface Servicio {
  id: string;
  codigo: string;
  cliente_id: string;
  mecanico_id: string | null;
  categoria_codigo: string;
  categoria_nombre: string;
  descripcion: string | null;
  ubicacion: UbicacionServicio;
  estado: EstadoServicio;
  eta_minutos: number | null;
  creado_en: string;
  finalizado_en: string | null;
  historial: HitoServicio[];
}

/** Contenido editorial del Home. Sin tabla asociada: es contenido de la Entrega 1. */
export interface Consejo {
  id: string;
  titulo: string;
  bajada: string;
  imagen_url: string | null;
}

/** Diapositiva del carrusel promocional del Home. */
export interface Promocion {
  id: string;
  titulo: string;
  titulo_destacado: string | null;
  bajada: string;
  imagen_url: string | null;
}

/** Paso del flujo de solicitud (RF-VIEW-006). */
export interface PasoSolicitud {
  numero: number;
  titulo: string;
}
