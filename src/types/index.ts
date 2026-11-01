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
  telefono?: string | null;
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
  /** Precio fijo del servicio en pesos: se muestra antes de pedir. */
  tarifa: number | null;
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

/** Cómo paga el cliente: elegido al pedir. Mercado Pago es simulado en esta entrega. */
export type MedioPago = 'mercado_pago' | 'efectivo';

/**
 * Situación del cobro (RF-PAY-003). Mercado Pago: retenido → cobrado | devuelto.
 * Efectivo: pendiente → cobrado | anulado. `sin_cobro`: solicitudes viejas, sin pago.
 */
export type EstadoPago = 'sin_cobro' | 'retenido' | 'pendiente' | 'cobrado' | 'devuelto' | 'anulado';

/** Tabla `pagos`: cobro simulado de un servicio con su comisión (RF-PAY-002, RN-012). */
export interface PagoServicio {
  id: string;
  /** Monto total del servicio (la tarifa). */
  monto: number;
  /** 10 % para la plataforma. */
  comision: number;
  /** 90 % para el mecánico. */
  neto_mecanico: number;
  medio: MedioPago;
  estado: Exclude<EstadoPago, 'sin_cobro'>;
  actualizado_en: string;
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
  /** Tarifa fijada al pedir: el cliente la conoce antes de confirmar. */
  monto_final: number | null;
  medio_pago: MedioPago;
  /** Null solo en solicitudes anteriores al cobro por adelantado. */
  pago: PagoServicio | null;
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
