import type { Posicion } from './seguimiento-vivo';

export type Ruta = {
  /** Puntos del recorrido por las calles, en orden. */
  puntos: Posicion[];
  distanciaMetros: number;
  duracionSegundos: number;
};

type RespuestaOsrm = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
};

// Servidor público de OSRM: arma recorridos sobre los datos de OpenStreetMap y no pide clave.
const SERVIDOR_RUTAS = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Recorrido por las calles entre dos puntos (RF-GPS-002).
 * Devuelve null si el servicio no responde, para que el mapa use una línea recta.
 */
export async function obtenerRuta(desde: Posicion, hasta: Posicion): Promise<Ruta | null> {
  const tramo = `${desde.longitud},${desde.latitud};${hasta.longitud},${hasta.latitud}`;
  try {
    const respuesta = await fetch(`${SERVIDOR_RUTAS}/${tramo}?overview=full&geometries=geojson`);
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as RespuestaOsrm;
    const ruta = datos.code === 'Ok' ? datos.routes?.[0] : undefined;
    if (!ruta || ruta.geometry.coordinates.length < 2) return null;
    return {
      // OSRM devuelve [longitud, latitud].
      puntos: ruta.geometry.coordinates.map(([longitud, latitud]) => ({ latitud, longitud })),
      distanciaMetros: ruta.distance,
      duracionSegundos: ruta.duration,
    };
  } catch (error) {
    console.warn('[RUTAS] No se pudo calcular el recorrido:', error);
    return null;
  }
}

/** Distancia aproximada en metros entre dos puntos (fórmula de Haversine). */
export function distanciaEntre(a: Posicion, b: Posicion): number {
  const radio = 6371000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLng = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 2 * radio * Math.asin(Math.sqrt(h));
}
