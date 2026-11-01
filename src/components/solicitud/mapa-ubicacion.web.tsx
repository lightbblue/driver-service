import 'leaflet/dist/leaflet.css';

import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import {
  ALTURA_MAPA,
  ATRIBUCION,
  CENTRO_POR_DEFECTO,
  CSS_PIN,
  ICONO_PIN,
  mismaPosicion,
  TESELAS,
  ZOOM_INICIAL,
  ZOOM_MAX_TESELAS,
  ZOOM_UBICADO,
  type Coordenadas,
  type MapaUbicacionProps,
} from './mapa-config';

/** Mapa con calles y pin arrastrable para la web (Leaflet). */
export function MapaUbicacion({ ubicacion, onMover, altura = ALTURA_MAPA }: MapaUbicacionProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const marcadorRef = useRef<Leaflet.Marker | null>(null);
  const onMoverRef = useRef(onMover);
  /** Última posición que salió del propio mapa: no hace falta recentrarlo. */
  const ultimaRef = useRef<Coordenadas | null>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    onMoverRef.current = onMover;
  }, [onMover]);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      // Leaflet usa `window` al importarse: se carga solo en el navegador.
      const L = await import('leaflet');
      if (cancelado || !contenedorRef.current) return;

      const centro: Leaflet.LatLngTuple = [CENTRO_POR_DEFECTO.latitud, CENTRO_POR_DEFECTO.longitud];
      const mapa = L.map(contenedorRef.current).setView(centro, ZOOM_INICIAL);
      L.tileLayer(TESELAS, { maxZoom: 19, maxNativeZoom: ZOOM_MAX_TESELAS, attribution: ATRIBUCION }).addTo(mapa);

      const marcador = L.marker(centro, {
        draggable: true,
        autoPan: true,
        icon: L.divIcon(ICONO_PIN),
      }).addTo(mapa);

      const mover = (latitud: number, longitud: number) => {
        ultimaRef.current = { latitud, longitud };
        onMoverRef.current(latitud, longitud);
      };

      marcador.on('dragend', () => {
        const { lat, lng } = marcador.getLatLng();
        mover(lat, lng);
      });

      mapa.on('click', (evento: Leaflet.LeafletMouseEvent) => {
        marcador.setLatLng(evento.latlng);
        mover(evento.latlng.lat, evento.latlng.lng);
      });

      mapaRef.current = mapa;
      marcadorRef.current = marcador;

      // El contenedor puede medirse después del primer render.
      setTimeout(() => mapa.invalidateSize(), 200);
      setListo(true);
    }

    iniciar().catch((error: unknown) => {
      console.error('[MAPA] No se pudo inicializar:', error);
      if (!cancelado) setFallo(true);
    });

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
  }, []);

  // Ubicación que llega desde afuera (GPS): mueve el pin y centra el mapa.
  useEffect(() => {
    if (!listo || !ubicacion || !mapaRef.current || !marcadorRef.current) return;
    if (mismaPosicion(ubicacion, ultimaRef.current)) return;

    ultimaRef.current = ubicacion;
    const posicion: Leaflet.LatLngTuple = [ubicacion.latitud, ubicacion.longitud];
    marcadorRef.current.setLatLng(posicion);
    mapaRef.current.setView(posicion, Math.max(mapaRef.current.getZoom(), ZOOM_UBICADO));
  }, [listo, ubicacion]);

  return (
    <View className="overflow-hidden rounded-tarjeta border border-borde bg-superficie-alta">
      <style>{CSS_PIN}</style>
      <div ref={contenedorRef} style={{ width: '100%', height: altura }} />
      {fallo ? (
        <View className="absolute inset-0 items-center justify-center bg-superficie-alta px-6">
          <Text className="text-center text-chico text-texto-tenue">
            No se pudo cargar el mapa. Revisá tu conexión; podés escribir la dirección igualmente.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
