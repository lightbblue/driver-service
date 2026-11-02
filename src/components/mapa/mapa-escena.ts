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
  /** Foto del taller: si está, el marcador la muestra en lugar del ícono. */
  foto?: string | null;
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

  // Taller con foto: círculo con la foto y el borde según su estado.
  function conFoto(tipo, foto) {
    var elegido = tipo === 'taller-elegido';
    var tam = elegido ? 46 : 38;
    var borde = elegido ? C.texto : tipo === 'taller-off' ? C.textoSutil : C.acento;
    var url = encodeURI(String(foto)).replace(/'/g, '%27');
    var html = '<div style="width:' + tam + 'px;height:' + tam + 'px;border-radius:50%;border:' + (elegido ? 3 : 2) +
      'px solid ' + borde + ';background:' + C.superficieAlta + ' url(\\'' + url + '\\') center/cover no-repeat;' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.45);opacity:' + (tipo === 'taller-off' ? 0.6 : 1) + '"></div>';
    return L.divIcon({ className: '', html: html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] });
  }

  // Taller sin foto: un local con toldo, como el ícono de taller de la app.
  // Es un SVG propio porque el mapa no tiene la fuente de íconos de la app.
  function tienda(color, fondo) {
    return '<svg width="18" height="18" viewBox="0 0 24 24">' +
      '<rect x="2.5" y="3" width="19" height="3.2" rx="1" fill="' + color + '"/>' +
      '<path d="M2.5 6 H21.5 V7.6 a2.375 2.375 0 0 1 -4.75 0 a2.375 2.375 0 0 1 -4.75 0 ' +
        'a2.375 2.375 0 0 1 -4.75 0 a2.375 2.375 0 0 1 -4.75 0 Z" fill="' + color + '"/>' +
      '<rect x="4" y="11" width="16" height="10" rx="1" fill="' + color + '"/>' +
      '<rect x="6.2" y="13" width="4" height="3.4" rx="0.5" fill="' + fondo + '"/>' +
      '<rect x="12.6" y="13" width="4.6" height="8" rx="0.5" fill="' + fondo + '"/>' +
    '</svg>';
  }

  function icono(tipo, foto) {
    var html, tam = 34;
    if (foto && (tipo === 'taller' || tipo === 'taller-elegido' || tipo === 'taller-off')) {
      return conFoto(tipo, foto);
    }
    if (tipo === 'yo') {
      tam = 22;
      html = '<div style="width:22px;height:22px;border-radius:50%;background:' + C.acento + '4D;border:2px solid ' +
        C.acento + ';display:flex;align-items:center;justify-content:center"><div style="width:10px;height:10px;' +
        'border-radius:50%;background:' + C.acento + '"></div></div>';
    } else if (tipo === 'taller-elegido') {
      html = circulo(C.acento, C.texto, tienda(C.textoInverso, C.acento), tam, 1);
    } else if (tipo === 'taller-off') {
      html = circulo(C.superficieAlta, C.textoSutil, tienda(C.textoSutil, C.superficieAlta), tam, 0.6);
    } else if (tipo === 'cliente') {
      // Dónde está el problema: triángulo de advertencia (SVG, se ve igual en todos los dispositivos).
      tam = 38;
      var advertencia = '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2.5 L23 21.5 H1 Z" fill="' +
        C.textoInverso + '" stroke="' + C.textoInverso + '" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<rect x="10.9" y="8.5" width="2.2" height="7" rx="1" fill="' + C.acento + '"/>' +
        '<circle cx="12" cy="18.3" r="1.3" fill="' + C.acento + '"/></svg>';
      html = circulo(C.acento, C.textoInverso, advertencia, tam, 1);
    } else if (tipo === 'mecanico') {
      tam = 38;
      html = circulo(C.exito, C.texto, '🔧', tam, 1);
    } else {
      html = circulo(C.superficieAlta, C.acento, tienda(C.acento, C.superficieAlta), tam, 1);
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
      // El ícono se rehace solo si cambió el estado o la foto.
      var clave = m.tipo + '|' + (m.foto || '');
      if (capa) {
        capa.setLatLng([m.latitud, m.longitud]);
        if (capa._clave !== clave) {
          capa.setIcon(icono(m.tipo, m.foto));
          capa.setZIndexOffset(m.tipo === 'taller-elegido' ? 800 : m.tipo === 'yo' ? 1000 : m.tipo === 'mecanico' ? 500 : 0);
          capa._clave = clave;
        }
      } else {
        capa = L.marker([m.latitud, m.longitud], {
          icon: icono(m.tipo, m.foto),
          zIndexOffset: m.tipo === 'taller-elegido' ? 800 : m.tipo === 'yo' ? 1000 : m.tipo === 'mecanico' ? 500 : 0
        }).addTo(mapa);
        capa._clave = clave;
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
    if (destruido) return;
    mapa.flyTo([lat, lng], zoom || mapa.getZoom(), { duration: 0.8 });
  }

  var destruido = false;
  var ajusteInicial = setTimeout(function () { mapa.invalidateSize(); }, 200);

  // Leaflet deja programado el final de la animación de zoom (250 ms). Si el mapa se
  // quita antes, ese paso usa paneles que ya no existen: se corta acá.
  function destruir() {
    if (destruido) return;
    destruido = true;
    clearTimeout(ajusteInicial);
    mapa._animatingZoom = false;
    mapa.stop();
    mapa.remove();
  }

  return {
    actualizar: function (estado) { if (!destruido) actualizar(estado); },
    volar: volar,
    destruir: destruir
  };
`;
