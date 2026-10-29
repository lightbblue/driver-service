
import * as Location from 'expo-location';
import type { UbicacionServicio } from '@/types';

export async function obtenerUbicacionActual(): Promise<UbicacionServicio> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error(
      'Necesitamos permiso para acceder a tu ubicación. Habilitalo en el navegador o en la configuración del celular.',
    );
  }

  const posicion = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = posicion.coords;

  let direccion = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  let localidad: string | null = null;

  try {
    const resultados = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (resultados.length > 0) {
      const lugar = resultados[0];
      localidad = lugar.city ?? lugar.subregion ?? null;

      direccion = [
        lugar.street,
        lugar.streetNumber,
        lugar.name,
        lugar.city,
        lugar.region,
      ]
        .filter(Boolean)
        .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
        .join(', ') || direccion;
    }
  } catch {
    // Si no se encuentra la dirección, conservamos las coordenadas reales.
  }

  return {
    latitud: latitude,
    longitud: longitude,
    direccion,
    localidad,
    referencia: null,
  };
}
