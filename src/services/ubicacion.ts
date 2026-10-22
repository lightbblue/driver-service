import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { UbicacionServicio } from '@/types';

type Direccion = Pick<UbicacionServicio, 'direccion'>;

export function coordenadasComoTexto(latitud: number, longitud: number): string {
  return `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`;
}

/** Une las partes de una dirección sin repetidos ni vacíos. */
function unir(partes: (string | null | undefined)[]): string {
  return partes
    .filter((p): p is string => !!p && p.trim().length > 0)
    .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
    .join(', ');
}

/** Geocodificación del sistema operativo (Android / iOS). */
async function direccionNativa(latitud: number, longitud: number): Promise<Direccion | null> {
  const [lugar] = await Location.reverseGeocodeAsync({ latitude: latitud, longitude: longitud });
  if (!lugar) return null;

  const calle = [lugar.street, lugar.streetNumber].filter(Boolean).join(' ');
  const direccion = unir([calle || lugar.name, lugar.city ?? lugar.subregion, lugar.region]);
  return direccion ? { direccion } : null;
}

/**
 * Geocodificación con Nominatim (OpenStreetMap). En la web expo-location no
 * resuelve direcciones, así que se usa siempre; en el celular es el respaldo.
 */
async function direccionNominatim(latitud: number, longitud: number): Promise<Direccion | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1` +
    `&accept-language=es&lat=${latitud}&lon=${longitud}`;

  const respuesta = await fetch(url, {
    // La política de uso de Nominatim pide identificar la app; el navegador ya envía el Referer.
    headers: Platform.OS === 'web' ? {} : { 'User-Agent': 'RiderService/1.0 (app educativa)' },
  });
  if (!respuesta.ok) return null;

  const datos = (await respuesta.json()) as {
    address?: Record<string, string | undefined>;
    display_name?: string;
  };
  const a = datos.address ?? {};
  const localidad = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? null;
  const calle = [a.road, a.house_number].filter(Boolean).join(' ');
  const direccion = unir([calle, localidad, a.state]) || datos.display_name || '';

  return direccion ? { direccion } : null;
}

/**
 * Dirección legible para unas coordenadas. Si no se puede resolver, devuelve
 * las coordenadas como texto para que el usuario la corrija a mano.
 */
export async function obtenerDireccion(latitud: number, longitud: number): Promise<Direccion> {
  const intentos =
    Platform.OS === 'web' ? [direccionNominatim] : [direccionNativa, direccionNominatim];

  for (const intento of intentos) {
    try {
      const resultado = await intento(latitud, longitud);
      if (resultado) return resultado;
    } catch (error) {
      console.warn('[UBICACION] No se pudo resolver la dirección:', error);
    }
  }

  return { direccion: coordenadasComoTexto(latitud, longitud) };
}

/** Pide permiso y devuelve la posición GPS actual con su dirección. */
export async function obtenerUbicacionActual(): Promise<UbicacionServicio> {
  const permiso = await Location.requestForegroundPermissionsAsync();

  if (permiso.status !== 'granted') {
    throw new Error(
      permiso.canAskAgain
        ? 'Necesitamos permiso para acceder a tu ubicación. Podés marcarla a mano en el mapa.'
        : 'El permiso de ubicación está bloqueado. Habilitalo en la configuración del navegador o del celular, o marcá tu ubicación a mano en el mapa.',
    );
  }

  if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) {
    throw new Error('El GPS del celular está apagado. Activalo o marcá tu ubicación a mano en el mapa.');
  }

  let posicion: Location.LocationObject;
  try {
    posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    // En interiores la precisión alta puede no responder: se usa la última posición conocida.
    const ultima = await Location.getLastKnownPositionAsync();
    if (!ultima) {
      throw new Error('No pudimos obtener tu posición. Intentá de nuevo o marcala a mano en el mapa.');
    }
    posicion = ultima;
  }

  const { latitude, longitude } = posicion.coords;
  const { direccion } = await obtenerDireccion(latitude, longitude);

  return { latitud: latitude, longitud: longitude, direccion };
}
