/**
 * Configuración compartida por el mapa web (Leaflet) y el nativo (Leaflet en WebView).
 *
 * Las teselas son de CARTO sobre datos de OpenStreetMap: muestran calles y,
 * a diferencia del servidor de teselas de OSM, no exigen un Referer, que el
 * WebView del celular no envía.
 */

export type Coordenadas = { latitud: number; longitud: number };

export type MapaUbicacionProps = {
  /** Posición del pin; null mientras no haya GPS ni elección manual. */
  ubicacion: Coordenadas | null;
  /** Se llama cuando el usuario arrastra el pin o toca el mapa. */
  onMover: (latitud: number, longitud: number) => void;
  /** Avisa cuando el dedo está sobre el mapa, para pausar el scroll de la pantalla. */
  onInteraccion?: (activa: boolean) => void;
  altura?: number;
};

export const TESELAS = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Centro inicial cuando todavía no hay ubicación (Pilar, Buenos Aires). */
export const CENTRO_POR_DEFECTO: Coordenadas = { latitud: -34.4587, longitud: -58.9142 };

export const ZOOM_INICIAL = 13;
export const ZOOM_UBICADO = 17;

export const ALTURA_MAPA = 260;

/** Pin con los colores de la marca (acento sobre fondo), dibujado en CSS. */
export const CSS_PIN = `
.pin-rider {
  box-sizing: border-box;
  width: 30px; height: 30px;
  border-radius: 50% 50% 50% 0;
  background: #FFC107;
  border: 3px solid #0B0B0D;
  transform: rotate(-45deg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}
.pin-rider::after {
  content: '';
  position: absolute; top: 7px; left: 7px;
  width: 10px; height: 10px; border-radius: 50%;
  background: #0B0B0D;
}
`;

/** Opciones de `L.divIcon` para el pin: la punta queda sobre la coordenada. */
export const ICONO_PIN = {
  className: '',
  html: '<div class="pin-rider"></div>',
  iconSize: [30, 30] as [number, number],
  iconAnchor: [15, 36] as [number, number],
};

export function mismaPosicion(a: Coordenadas | null, b: Coordenadas | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.latitud - b.latitud) < 1e-7 && Math.abs(a.longitud - b.longitud) < 1e-7;
}
