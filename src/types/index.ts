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

/** Columnas `latitud`, `longitud`, `direccion` y `localidad` de `solicitudes`. */
export interface UbicacionServicio {
  latitud: number;
  longitud: number;
  direccion: string;
  localidad: string | null;
}

/** Fila de `historial_solicitudes`. */
export interface HitoServicio {
  id: string;
  estado_anterior: EstadoServicio | null;
  estado_nuevo: EstadoServicio;
  ocurrido_en: string;
  observacion: string | null;
}

export type ActorCancelacion = 'cliente' | 'mecanico';

/** Datos públicos del taller asignado (tabla `mecanicos`). */
export interface MecanicoAsignado {
  id: string;
  nombre: string | null;
  telefono: string | null;
}

/** Tabla `solicitudes` con su categoría, su mecánico y su historial. */
export interface Servicio {
  id: string;
  /** Derivado del id: identificador corto para mostrar. */
  codigo: string;
  cliente_id: string;
  mecanico_id: string | null;
  mecanico: MecanicoAsignado | null;
  categoria_id: string | null;
  categoria_nombre: string;
  categoria_icono: string | null;
  descripcion: string | null;
  ubicacion: UbicacionServicio;
  estado: EstadoServicio;
  eta_minutos: number | null;
  motivo_cancelacion: string | null;
  cancelado_por: ActorCancelacion | null;
  creado_en: string;
  actualizado_en: string;
  /** Derivado del historial. */
  finalizado_en: string | null;
  /** Ordenado del más antiguo al más reciente. */
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
