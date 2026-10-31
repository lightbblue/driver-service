/**
 * Entidades del dominio de Rider Service.
 *
 * Reflejan las tablas del modelo de datos (documento 03) para que la migración
 * de JSON a Supabase no obligue a reescribir componentes (RNF-SCAL-001).
 * Los campos marcados como "derivado" no son columnas: en la Entrega 2 los
 * resuelve una función o una vista, y la capa de servicios los sigue exponiendo igual.
 */

export type RolUsuario = 'cliente' | 'mecanico' | 'admin';

/**
 * Estados del servicio (RF-STATE-001). `pendiente` es el estado inicial que la
 * base ya usaba; equivale a "Solicitado" en el SRS.
 */
export type EstadoServicio =
  | 'pendiente'
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

/** Columnas `latitud`, `longitud` y `direccion` de `solicitudes`. */
export interface UbicacionServicio {
  latitud: number;
  longitud: number;
  direccion: string;
}

/** Tabla `historial_solicitudes`: bitácora de cambios de estado (RF-DATA-004). */
export interface HitoServicio {
  id: string;
  estado_anterior: EstadoServicio | null;
  estado_nuevo: EstadoServicio;
  /** Usuario que hizo el cambio. */
  actor_id: string | null;
  ocurrido_en: string;
  /** Columna `nota`: observación del cambio o motivo de la cancelación. */
  observacion: string | null;
}

export type ActorCancelacion = 'cliente' | 'mecanico';

/** Taller asignado (tabla `mecanicos`). */
export interface MecanicoAsignado {
  id: string;
  nombre: string;
  telefono: string | null;
}

/** Tabla `solicitudes` con su categoría, su mecánico y su historial. */
export interface Servicio {
  id: string;
  /** Código legible generado por la base: RS-2026-0013 (RF-ASSIST-005). */
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
  /** Derivado del actor del hito de cancelación. */
  cancelado_por: ActorCancelacion | null;
  /** Monto final del servicio en pesos (RF-QUOTE-001, RN-014). */
  monto_final: number | null;
  creado_en: string;
  actualizado_en: string;
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


/** Detalle de un servicio cobrado en las ganancias del mecánico (RF-PAY-004, RF-VIEW-015). */
export interface ServicioCobrado {
  id: string;
  solicitud_id: string;
  codigo_solicitud: string;
  categoria_nombre: string;
  fecha_cobro: string;
  monto_total: number;
  neto_mecanico: number;
  comision_plataforma: number;
  estado_pago: 'aprobado' | 'pendiente' | 'rechazado';
}

/** Resumen de ganancias acumuladas del mecánico (RF-PAY-004). */
export interface ResumenGanancias {
  servicios: ServicioCobrado[];
  total_a_liquidar: number;
  total_bruto: number;
  total_comisiones: number;
  cantidad_servicios: number;
}
