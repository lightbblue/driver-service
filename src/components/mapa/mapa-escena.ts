/**
 * Mapa único de la app (Leaflet + teselas de Esri World Street Map).
 *
 * La lógica del mapa vive en `CUERPO_ESCENA`, un texto de JavaScript que se ejecuta
 * igual en los dos lados:
 * - en el celular, dentro del WebView (`mapa-leaflet.tsx`);
 * - en la web, con la librería `leaflet` (`mapa-leaflet.web.tsx`).
 * Así el mapa se ve y se comporta igual en todos lados.
 */
import { ATRIBUCION, TESELAS, ZOOM_MAX_TESELAS, type Coordenadas } from '@/components/solicitud/mapa-config';
import { COLORES } from '@/lib/tema';

export type { Coordenadas };

/** Cómo se dibuja cada marcador. */
export type TipoMarcador =
  | 'taller'
  | 'taller-elegido'
  | 'taller-off'
  | 'yo'
  | 'cliente'
  | 'mecanico';

export type MarcadorMapa = {
  id: string;
  latitud: number;
  longitud: number;
  tipo: TipoMarcador;
};

export type MapaLeafletProps = {
  marcadores: MarcadorMapa[];
  /** Solo se usa al crear el mapa; después se mueve con `volarA` o `encuadrar`. */
  centroInicial: Coordenadas;
  zoomInicial?: number;
  /**
   * Recorrido a dibujar (por ejemplo, del mecánico al cliente). Con más de dos puntos es una
   * ruta por las calles y va continua; con dos es una línea recta de respaldo y va punteada.
   */
  linea?: Coordenadas[] | null;
  /** Ajusta la vista para que entren todos los marcadores cada vez que cambia cuáles hay. */
  encuadrar?: boolean;
  onTocarMarcador?: (id: string) => void;
  /** Alto fijo en píxeles; sin alto, ocupa todo el espacio disponible. */
  altura?: number;
};

export type MapaLeafletRef = {
  volarA: (destino: Coordenadas, zoom?: number) => void;
};

/** Lo que el mapa necesita al crearse. */
export function opcionesEscena(centro: Coordenadas, zoom: number) {
  return {
    lat: centro.latitud,
    lng: centro.longitud,
    zoom,
    teselas: TESELAS,
    zoomMaxTeselas: ZOOM_MAX_TESELAS,
    atribucion: ATRIBUCION,
    colores: {
      acento: COLORES.acento,
      superficieAlta: COLORES.superficieAlta,
      texto: COLORES.texto,
      textoInverso: COLORES.textoInverso,
      textoSutil: COLORES.textoSutil,
      exito: COLORES.exito,
    },
  };
}

/** Estado que se le pasa al mapa en cada cambio. */
export function estadoEscena(
  marcadores: MarcadorMapa[],
  linea: Coordenadas[] | null,
  encuadrar: boolean,
) {
  return {
    marcadores,
    linea: linea && linea.length >= 2 ? linea.map((p) => [p.latitud, p.longitud]) : null,
    encuadrar,
  };
}

/**
 * Cuerpo de `function (L, contenedor, opciones, enviar)`. Devuelve
 * `{ actualizar(estado), volar(lat, lng, zoom), destruir() }`.
 * `enviar` recibe `{ tipo: 'marcador', id }` cuando se toca un marcador.
 */
export const CUERPO_ESCENA = `
  var C = opciones.colores;
  var mapa = L.map(contenedor, { zoomControl: false }).setView([opciones.lat, opciones.lng], opciones.zoom);
  L.tileLayer(opciones.teselas, {
    maxZoom: 19, maxNativeZoom: opciones.zoomMaxTeselas, attribution: opciones.atribucion
  }).addTo(mapa);

  function circulo(fondo, borde, contenido, tam, opacidad) {
    return '<div style="width:' + tam + 'px;height:' + tam + 'px;border-radius:50%;background:' + fondo +
      ';border:2px solid ' + borde + ';display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.45);opacity:' + opacidad + ';font-size:' + Math.round(tam * 0.45) + 'px">' +
      contenido + '</div>';
  }

  function icono(tipo) {
    var html, tam = 34;
    if (tipo === 'yo') {
      tam = 22;
      html = '<div style="width:22px;height:22px;border-radius:50%;background:' + C.acento + '4D;border:2px solid ' +
        C.acento + ';display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;' +
        'border-radius:50%;background:' + C.acento + '"></div></div>';
    } else if (tipo === 'taller-elegido') {
      html = circulo(C.acento, C.texto, '🔧', tam, 1);
    } else if (tipo === 'taller-off') {
      html = circulo(C.superficieAlta, C.textoSutil, '🔧', tam, 0.6);
    } else if (tipo === 'cliente') {
      tam = 38;
      html = circulo(C.acento, C.textoInverso, '🏍️', tam, 1);
    } else if (tipo === 'mecanico') {
      tam = 38;
      html = circulo(C.exito, C.texto, '🛠️', tam, 1);
    } else {
      html = circulo(C.superficieAlta, C.acento, '🔧', tam, 1);
    }
    return L.divIcon({ className: '', html: html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
  }

  var capas = {};
  var linea = null;
  var firmaEncuadre = '';

  function actualizar(estado) {
    var vistos = {};
    estado.marcadores.forEach(function (m) {
      vistos[m.id] = true;
      var capa = capas[m.id];
      if (capa) {
        capa.setLatLng([m.latitud, m.longitud]);
        if (capa._tipo !== m.tipo) { capa.setIcon(icono(m.tipo)); capa._tipo = m.tipo; }
      } else {
        capa = L.marker([m.latitud, m.longitud], {
          icon: icono(m.tipo),
          zIndexOffset: m.tipo === 'yo' ? 1000 : m.tipo === 'mecanico' ? 500 : 0
        }).addTo(mapa);
        capa._tipo = m.tipo;
        capa.on('click', function () { enviar({ tipo: 'marcador', id: m.id }); });
        capas[m.id] = capa;
      }
    });
    Object.keys(capas).forEach(function (id) {
      if (!vistos[id]) { capas[id].remove(); delete capas[id]; }
    });

    if (linea) { linea.remove(); linea = null; }
    if (estado.linea) {
      var porCalles = estado.linea.length > 2;
      linea = L.polyline(estado.linea, {
        color: C.acento, weight: porCalles ? 5 : 4, opacity: 0.9, dashArray: porCalles ? null : '8 8'
      }).addTo(mapa);
    }

    if (estado.encuadrar && estado.marcadores.length > 0) {
      var firma = estado.marcadores.map(function (m) { return m.id; }).sort().join(',');
      if (firma !== firmaEncuadre) {
        firmaEncuadre = firma;
        if (estado.marcadores.length === 1) {
          mapa.setView([estado.marcadores[0].latitud, estado.marcadores[0].longitud], 15);
        } else {
          var puntos = estado.marcadores.map(function (m) { return [m.latitud, m.longitud]; });
          mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 16 });
        }
      }
    }
  }

  function volar(lat, lng, zoom) {
    mapa.flyTo([lat, lng], zoom || mapa.getZoom(), { duration: 0.8 });
  }

  setTimeout(function () { mapa.invalidateSize(); }, 200);

  return { actualizar: actualizar, volar: volar, destruir: function () { mapa.remove(); } };
`;
