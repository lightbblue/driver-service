import 'leaflet/dist/leaflet.css';

import type * as Leaflet from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  CUERPO_ESCENA,
  estadoEscena,
  opcionesEscena,
  type MapaLeafletProps,
  type MapaLeafletRef,
} from './mapa-escena';

type Escena = {
  actualizar: (estado: ReturnType<typeof estadoEscena>) => void;
  volar: (lat: number, lng: number, zoom: number) => void;
  destruir: () => void;
};

type CrearEscena = (
  L: typeof Leaflet,
  contenedor: HTMLElement,
  opciones: ReturnType<typeof opcionesEscena>,
  enviar: (mensaje: { tipo: string; id?: string }) => void,
) => Escena;

// La misma lógica que corre en el WebView del celular (ver mapa-escena.ts).
const crearEscena = new Function('L', 'contenedor', 'opciones', 'enviar', CUERPO_ESCENA) as CrearEscena;

/** Mapa Leaflet de la app para la web. */
export const MapaLeaflet = forwardRef<MapaLeafletRef, MapaLeafletProps>(function MapaLeaflet(
  { marcadores, centroInicial, zoomInicial = 13, linea = null, encuadrar = false, onTocarMarcador, altura },
  ref,
) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const escenaRef = useRef<Escena | null>(null);
  const inicialRef = useRef({ centroInicial, zoomInicial });
  const alTocarRef = useRef(onTocarMarcador);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    alTocarRef.current = onTocarMarcador;
  }, [onTocarMarcador]);

  // Si piden volar antes de que Leaflet termine de cargar, se guarda y se hace al estar listo.
  const vueloPendienteRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  useImperativeHandle(ref, () => ({
    volarA: (destino, zoom) => {
      const vuelo = { lat: destino.latitud, lng: destino.longitud, zoom: zoom ?? 0 };
      if (escenaRef.current) escenaRef.current.volar(vuelo.lat, vuelo.lng, vuelo.zoom);
      else vueloPendienteRef.current = vuelo;
    },
  }));

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const L = await import('leaflet');
      if (cancelado || !contenedorRef.current) return;
      const { centroInicial: centro, zoomInicial: zoom } = inicialRef.current;
      escenaRef.current = crearEscena(L, contenedorRef.current, opcionesEscena(centro, zoom), (mensaje) => {
        if (mensaje.tipo === 'marcador' && mensaje.id) alTocarRef.current?.(mensaje.id);
      });
      const pendiente = vueloPendienteRef.current;
      if (pendiente) {
        vueloPendienteRef.current = null;
        escenaRef.current.volar(pendiente.lat, pendiente.lng, pendiente.zoom);
      }
      setListo(true);
    })();
    return () => {
      cancelado = true;
      escenaRef.current?.destruir();
      escenaRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!listo) return;
    escenaRef.current?.actualizar(estadoEscena(marcadores, linea, encuadrar));
  }, [listo, marcadores, linea, encuadrar]);

  return (
    <View style={altura ? { height: altura } : { flex: 1 }} className="overflow-hidden bg-superficie-alta">
      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});
