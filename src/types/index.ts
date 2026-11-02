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
  /** El mecánico terminó; el cliente confirma si quedó resuelto (recién ahí se cobra). */
  | 'por_confirmar'
  | 'finalizado'
  | 'no_resuelta'
  | 'cancelada';

/** Estadísticas del perfil del mecánico: las calcula `estadisticas_mecanico_actual()`. */
export interface EstadisticasPerfil {
  /** Servicios que terminaron finalizados. */
  resueltas: number;
  /** Promedio de estrellas (1 a 5), o null si nadie lo calificó todavía. */
  calificacion: number | null;
  cantidad_calificaciones: number;
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
  /** Año de alta de la cuenta. */
  miembro_desde: number;
  /** Solo para mecánicos: el cliente no ve estadísticas. */
  estadisticas: EstadisticasPerfil | null;
}

/**
 * Prestador que se muestra en el mapa, la lista y el inicio: un taller (tabla `talleres`)
 * o un mecánico que trabaja en ruta, sin taller (tabla `mecanicos`).
 */
export interface Mecanico {
  /** Id del taller o del mecánico, según `tipo`. */
  id: string;
  tipo: 'taller' | 'mecanico';
  /** Tiene al menos un mecánico con cuenta: se le puede pedir asistencia por la app. */
  adherido: boolean;
  /** Solo talleres: cuántos mecánicos con cuenta tiene. */
  cantidad_mecanicos: number;
  /** Solo talleres: promedio de estrellas de sus mecánicos (aparte de las reseñas del taller). */
  calificacion_mecanicos: number | null;
  calificaciones_mecanicos: number;
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

/** Mecánico que aceptó la solicitud (tabla `mecanicos`) y su taller, si tiene. */
export interface MecanicoAsignado {
  id: string;
  nombre: string;
  telefono: string | null;
  taller: string | null;
}

/** Cliente que pidió la solicitud, como lo ve el mecánico. El teléfono llega solo si ya la aceptó. */
export interface ClienteSolicitud {
  nombre: string;
  avatar_url: string | null;
  telefono: string | null;
}

/** Tabla `notificaciones`: aviso de la campana (RF-NOTIF-001). */
export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string | null;
  /** Solicitud a la que lleva el aviso al tocarlo. */
  solicitud_id: string | null;
  /** `taller`: pedidos para sumarse y sus respuestas; lleva a Mi taller. */
  tipo: 'solicitud' | 'taller';
  leida: boolean;
  creado_en: string;
}

/** El taller del mecánico autenticado y su lugar en él. */
export interface MiTaller {
  id: string;
  nombre: string;
  descripcion: string | null;
  telefono: string | null;
  direccion: string;
  localidad: string | null;
  latitud: number;
  longitud: number;
  especialidades: string[];
  imagen_url: string | null;
  /** Dueño: lo edita y administra miembros. Pendiente: pidió sumarse y espera respuesta. */
  rol: 'dueno' | 'miembro' | 'pendiente';
}

/** Mecánico del taller (o que pidió sumarse), como lo ve Mi taller. */
export interface MiembroTaller {
  mecanico_id: string;
  nombre: string;
  avatar_url: string | null;
  telefono: string | null;
  estado: 'dueno' | 'miembro' | 'pendiente';
}

/** Tabla `fotos_taller`: galería del taller. */
export interface FotoTaller {
  id: string;
  url: string;
}

/** Tabla `resenas_taller`, con el nombre y la foto de quien la escribió. */
export interface ResenaTaller {
  id: string;
  nombre: string;
  avatar_url: string | null;
  puntaje: number;
  comentario: string | null;
  creado_en: string;
  es_mia: boolean;
}

/** Taller que se puede elegir al registrarse como mecánico. */
export interface TallerOpcion {
  id: string;
  nombre: string;
  direccion: string;
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

/** La app atiende autos y motos: el cliente indica cuál es al pedir. */
export type TipoVehiculo = 'auto' | 'moto';

/** Tabla `calificaciones`: de 1 a 5 estrellas, solo el cliente y solo un servicio finalizado (RN-011). */
export interface CalificacionServicio {
  puntaje: number;
  comentario: string | null;
  creado_en: string;
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
  /** Null en solicitudes anteriores a que se pidiera el vehículo. */
  tipo_vehiculo: TipoVehiculo | null;
  vehiculo_modelo: string | null;
  ubicacion: UbicacionServicio;
  estado: EstadoServicio;
  eta_minutos: number | null;
  motivo_cancelacion: string | null;
  /** Derivado del actor del hito de cancelación. */
  cancelado_por: ActorCancelacion | null;
  /** Por qué el mecánico no pudo resolverlo (estado `no_resuelta`). */
  motivo_no_resuelta: string | null;
  /** Estrellas que dio el cliente a un servicio finalizado, si ya lo calificó. */
  calificacion: CalificacionServicio | null;
  /** Solo en las vistas del mecánico: quién la pidió. */
  cliente: ClienteSolicitud | null;
  /** A quién se la pidió el cliente desde el mapa. Null: la puede tomar cualquier mecánico (SOS). */
  destino: { tipo: 'taller' | 'mecanico'; id: string; nombre: string } | null;
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
