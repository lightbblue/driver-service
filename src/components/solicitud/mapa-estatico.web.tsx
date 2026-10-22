import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { UbicacionServicio } from '@/types';

type MapaEstaticoProps = {
  etiqueta?: string;
  ubicacion: UbicacionServicio | null;
  onMover: (latitud: number, longitud: number) => void;
};

export function MapaEstatico({
  etiqueta = 'Mové el pin para ajustar tu ubicación',
  ubicacion,
  onMover,
}: MapaEstaticoProps) {
  const [estadoGps, setEstadoGps] = useState('Buscando tu ubicación...');
  const [coordenadasGps, setCoordenadasGps] = useState('Esperando coordenadas...');
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const marcadorRef = useRef<Leaflet.Marker | null>(null);
  const onMoverRef = useRef(onMover);

  onMoverRef.current = onMover;

  useEffect(() => {
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    async function iniciarMapa() {
      if (typeof window === 'undefined' || !contenedorRef.current) return;

      const L = await import('leaflet');

      if (cancelado || !contenedorRef.current) return;

      const centro: Leaflet.LatLngExpression = ubicacion
        ? [ubicacion.latitud, ubicacion.longitud]
        : [-34.4751, -58.7537];

      const mapa = L.map(contenedorRef.current).setView(centro, 16);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);

      const marcador = L.marker(centro, {
        draggable: true,
        autoPan: true,
      }).addTo(mapa);

      // PUNTO_AZUL_GPS: ubicación real del dispositivo.
      if (navigator.geolocation) {
        setEstadoGps('Solicitando permiso de ubicación...');
        navigator.geolocation.getCurrentPosition(
          (posicion) => {
            if (cancelado) return;
            setEstadoGps('Ubicación obtenida por el navegador');
            setCoordenadasGps(`Latitud: ${posicion.coords.latitude} | Longitud: ${posicion.coords.longitude} | Precisión: ${Math.round(posicion.coords.accuracy)} metros`);
            console.log('[GPS] Latitud:', posicion.coords.latitude);
            console.log('[GPS] Longitud:', posicion.coords.longitude);
            console.log('[GPS] Precisión estimada en metros:', posicion.coords.accuracy);


            const actual: Leaflet.LatLngExpression = [
              posicion.coords.latitude,
              posicion.coords.longitude,
            ];

            L.circleMarker(actual, {
              radius: 8,
              color: '#ffffff',
              weight: 3,
              fillColor: '#1688ff',
              fillOpacity: 1,

})
              .addTo(mapa)
              .bindPopup('Tu ubicación actual');

            mapa.setView(actual, 16);
          },
          (error) => {
            if (!cancelado) setEstadoGps(`No se pudo obtener el GPS: ${error.message}`);
            console.warn('[GPS] No se pudo detectar la ubicación:', error.message);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
      } else {
        setEstadoGps('Este navegador no ofrece geolocalización.');
      }

      marcador.on('dragend', () => {
        const posicion = marcador.getLatLng();
        onMoverRef.current(posicion.lat, posicion.lng);
      });

      mapa.on('click', (evento: Leaflet.LeafletMouseEvent) => {
        marcador.setLatLng(evento.latlng);
        onMoverRef.current(evento.latlng.lat, evento.latlng.lng);
      });

      mapaRef.current = mapa;
      marcadorRef.current = marcador;

      temporizador = setTimeout(() => {
        mapa.invalidateSize();
      }, 200);
    }

    void iniciarMapa().catch((error: unknown) => {
      console.error('[MAPA] No se pudo inicializar:', error);
    });

    return () => {
      cancelado = true;

      if (temporizador !== undefined) {
        clearTimeout(temporizador);
      }

      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ubicacion || !mapaRef.current || !marcadorRef.current) return;

    const posicion: Leaflet.LatLngExpression = [
      ubicacion.latitud,
      ubicacion.longitud,
    ];

    marcadorRef.current.setLatLng(posicion);
    mapaRef.current.setView(posicion, 16);
  }, [ubicacion?.latitud, ubicacion?.longitud]);

  return (
    <View className="overflow-hidden rounded-tarjeta border border-borde bg-superficie-alta">
      <View className="px-3 py-2">
        <Text>{etiqueta}</Text>
      </View>

      <div
        ref={contenedorRef}
        style={{ width: '100%', height: 280 }}
      />

      <View className="px-3 py-2">
        <Text>{estadoGps}</Text>
        <Text>{coordenadasGps}</Text>
        <Text>
          Tocá el mapa o arrastrá el pin para corregir la ubicación.
        </Text>
      </View>
    </View>
  );
}
