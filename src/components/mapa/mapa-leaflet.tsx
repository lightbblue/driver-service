import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { COLORES } from '@/lib/tema';

import {
  CUERPO_ESCENA,
  estadoEscena,
  opcionesEscena,
  type MapaLeafletProps,
  type MapaLeafletRef,
} from './mapa-escena';

type Mensaje = { tipo: 'listo' } | { tipo: 'error'; mensaje: string } | { tipo: 'marcador'; id: string };

function htmlMapa(opciones: ReturnType<typeof opcionesEscena>): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html, body, #mapa { margin: 0; padding: 0; height: 100%; background: ${COLORES.superficieAlta}; }</style>
</head>
<body>
<div id="mapa"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function enviar(datos) { window.ReactNativeWebView.postMessage(JSON.stringify(datos)); }
  try {
    window.escena = (function (L, contenedor, opciones, enviar) { ${CUERPO_ESCENA} })(
      L, document.getElementById('mapa'), ${JSON.stringify(opciones)}, enviar
    );
    enviar({ tipo: 'listo' });
  } catch (error) {
    enviar({ tipo: 'error', mensaje: String(error) });
  }
</script>
</body>
</html>`;
}

/** Mapa Leaflet de la app para Android e iOS (dentro de un WebView; funciona en Expo Go). */
export const MapaLeaflet = forwardRef<MapaLeafletRef, MapaLeafletProps>(function MapaLeaflet(
  { marcadores, centroInicial, zoomInicial = 13, linea = null, encuadrar = false, onTocarMarcador, altura },
  ref,
) {
  // El genérico explícito evita que los tipos de webview 14 resuelvan las props a `never`.
  const webViewRef = useRef<WebView<object>>(null);
  const [html] = useState(() => htmlMapa(opcionesEscena(centroInicial, zoomInicial)));
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const alTocarRef = useRef(onTocarMarcador);
  useEffect(() => {
    alTocarRef.current = onTocarMarcador;
  }, [onTocarMarcador]);

  useImperativeHandle(ref, () => ({
    volarA: (destino, zoom) =>
      webViewRef.current?.injectJavaScript(
        `window.escena && window.escena.volar(${destino.latitud}, ${destino.longitud}, ${zoom ?? 0}); true;`,
      ),
  }));

  useEffect(() => {
    if (!listo) return;
    const estado = estadoEscena(marcadores, linea, encuadrar);
    webViewRef.current?.injectJavaScript(
      `window.escena && window.escena.actualizar(${JSON.stringify(estado)}); true;`,
    );
  }, [listo, marcadores, linea, encuadrar]);

  const recibir = (evento: WebViewMessageEvent) => {
    let mensaje: Mensaje;
    try {
      mensaje = JSON.parse(evento.nativeEvent.data) as Mensaje;
    } catch {
      return;
    }
    if (mensaje.tipo === 'listo') setListo(true);
    else if (mensaje.tipo === 'marcador') alTocarRef.current?.(mensaje.id);
    else {
      console.error('[MAPA] Error dentro del WebView:', mensaje.mensaje);
      setFallo(true);
    }
  };

  return (
    <View style={altura ? { height: altura } : { flex: 1 }} className="overflow-hidden bg-superficie-alta">
      <WebView<object>
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://riderservice.app/' }}
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
            No se pudo cargar el mapa. Revisá tu conexión.
          </Text>
        </View>
      ) : null}
    </View>
  );
});
