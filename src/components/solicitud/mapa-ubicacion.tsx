import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { COLORES } from '@/lib/tema';

import {
  ALTURA_MAPA,
  ATRIBUCION,
  CENTRO_POR_DEFECTO,
  CSS_PIN,
  ICONO_PIN,
  mismaPosicion,
  TESELAS,
  ZOOM_INICIAL,
  ZOOM_UBICADO,
  type Coordenadas,
  type MapaUbicacionProps,
} from './mapa-config';

/**
 * Página del mapa que corre dentro del WebView. Es Leaflet, igual que en la web:
 * no requiere clave de Google Maps y funciona en Expo Go.
 */
const HTML_MAPA = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #mapa { margin: 0; padding: 0; height: 100%; background: ${COLORES.superficieAlta}; }
  ${CSS_PIN}
</style>
</head>
<body>
<div id="mapa"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function enviar(datos) { window.ReactNativeWebView.postMessage(JSON.stringify(datos)); }
  try {
    var centro = [${CENTRO_POR_DEFECTO.latitud}, ${CENTRO_POR_DEFECTO.longitud}];
    var mapa = L.map('mapa').setView(centro, ${ZOOM_INICIAL});
    L.tileLayer('${TESELAS}', { maxZoom: 19, attribution: '${ATRIBUCION}' }).addTo(mapa);
    var marcador = L.marker(centro, { draggable: true, autoPan: true, icon: L.divIcon(${JSON.stringify(ICONO_PIN)}) }).addTo(mapa);

    marcador.on('dragend', function () {
      var p = marcador.getLatLng();
      enviar({ tipo: 'mover', latitud: p.lat, longitud: p.lng });
    });
    mapa.on('click', function (e) {
      marcador.setLatLng(e.latlng);
      enviar({ tipo: 'mover', latitud: e.latlng.lat, longitud: e.latlng.lng });
    });

    window.ubicar = function (latitud, longitud) {
      marcador.setLatLng([latitud, longitud]);
      mapa.setView([latitud, longitud], Math.max(mapa.getZoom(), ${ZOOM_UBICADO}));
    };
    enviar({ tipo: 'listo' });
  } catch (error) {
    enviar({ tipo: 'error', mensaje: String(error) });
  }
</script>
</body>
</html>`;

type Mensaje =
  | { tipo: 'listo' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'mover'; latitud: number; longitud: number };

/** Mapa con calles y pin arrastrable para Android e iOS. */
export function MapaUbicacion({
  ubicacion,
  onMover,
  onInteraccion,
  altura = ALTURA_MAPA,
}: MapaUbicacionProps) {
  // El genérico explícito evita que los tipos de webview 14 resuelvan las props a `never`.
  const webViewRef = useRef<WebView<object>>(null);
  /** Última posición que salió del propio mapa: no hace falta recentrarlo. */
  const ultimaRef = useRef<Coordenadas | null>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);

  // Ubicación que llega desde afuera (GPS): mueve el pin y centra el mapa.
  useEffect(() => {
    if (!listo || !ubicacion || mismaPosicion(ubicacion, ultimaRef.current)) return;

    ultimaRef.current = ubicacion;
    webViewRef.current?.injectJavaScript(
      `window.ubicar(${ubicacion.latitud}, ${ubicacion.longitud}); true;`,
    );
  }, [listo, ubicacion]);

  const recibir = (evento: WebViewMessageEvent) => {
    let mensaje: Mensaje;
    try {
      mensaje = JSON.parse(evento.nativeEvent.data) as Mensaje;
    } catch {
      return;
    }

    if (mensaje.tipo === 'listo') {
      setListo(true);
    } else if (mensaje.tipo === 'error') {
      console.error('[MAPA] Error dentro del WebView:', mensaje.mensaje);
      setFallo(true);
    } else if (mensaje.tipo === 'mover') {
      ultimaRef.current = { latitud: mensaje.latitud, longitud: mensaje.longitud };
      onMover(mensaje.latitud, mensaje.longitud);
    }
  };

  return (
    <View
      className="overflow-hidden rounded-tarjeta border border-borde bg-superficie-alta"
      style={{ height: altura }}
      onTouchStart={() => onInteraccion?.(true)}
      onTouchEnd={() => onInteraccion?.(false)}
      onTouchCancel={() => onInteraccion?.(false)}>
      <WebView<object>
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: HTML_MAPA, baseUrl: 'https://riderservice.app/' }}
        onMessage={recibir}
        onError={() => setFallo(true)}
        javaScriptEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ backgroundColor: 'transparent' }}
      />

      {!listo && !fallo ? (
        <View className="absolute inset-0 items-center justify-center bg-superficie-alta">
          <ActivityIndicator color={COLORES.acento} />
        </View>
      ) : null}

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
