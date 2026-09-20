/** Formateo de fechas para la interfaz. Los datos viajan siempre en UTC (ISO 8601). */

const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
const HORA = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

export function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return FECHA.format(new Date(iso));
}

export function formatearHora(iso: string | null): string {
  if (!iso) return '—';
  return HORA.format(new Date(iso));
}

export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '—';
  return `${formatearFecha(iso)} · ${formatearHora(iso)}`;
}

export function formatearDistancia(km: number | null): string {
  if (km == null) return 'Distancia no disponible';
  return `${km.toFixed(1)} km`;
}
