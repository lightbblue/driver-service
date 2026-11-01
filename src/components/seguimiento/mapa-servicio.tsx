import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import type { Coordenadas, MarcadorMapa } from '@/components/mapa/mapa-escena';
import { MapaLeaflet } from '@/components/mapa/mapa-leaflet';
import { Tarjeta } from '@/components/ui';
import {
  compartirUbicacionMecanico,
  distanciaEntre,
  obtenerRuta,
  obtenerUbicacionMecanico,
  suscribirseAUbicacionMecanico,
  type Posicion,
  type Ruta,
} from '@/services';
import type { EstadoServicio, Servicio } from '@/types';

/** Estados en los que el mecánico está yendo o en el lugar: se comparte su posición. */
const EN_CURSO: EstadoServicio[] = ['aceptado', 'en_camino', 'llegue', 'trabajando'];
/** Estados en los que el mecánico está viajando: se dibuja la línea hasta el cliente. */
const VIAJANDO: EstadoServicio[] = ['aceptado', 'en_camino'];
/** La ruta se vuelve a pedir recién cuando el mecánico se alejó esto (en metros) del punto de partida. */
const RECALCULAR_RUTA_METROS = 150;

type RutaCalculada = { origen: Posicion; destino: Coordenadas; datos: Ruta | null };

function textoLlegada(ruta: Ruta): string {
  const minutos = Math.max(1, Math.round(ruta.duracionSegundos / 60));
  const km = (ruta.distanciaMetros / 1000).toFixed(1).replace('.', ',');
  return `Llega en ~${minutos} min · ${km} km`;
}

type MapaServicioProps = {
  servicio: Servicio;
  /** El mecánico asignado comparte su ubicación desde este mapa. */
  esAsignado: boolean;
};

/**
 * Mapa del seguimiento (RF-VIEW-008, RF-GPS-001, RF-GPS-002, RF-GPS-004).
 * - Todos ven dónde está el cliente; el mecánico, incluso antes de aceptar.
 * - Con el servicio en curso, el cliente ve al mecánico moverse en vivo.
 */
export function MapaServicio({ servicio, esAsignado }: MapaServicioProps) {
  const [posicionGuardada, setPosicionMecanico] = useState<Posicion | null>(null);
  const [errorCompartir, setErrorUbicacion] = useState<string | null>(null);

  const enCurso = !!servicio.mecanico_id && EN_CURSO.includes(servicio.estado);

  // Posición del mecánico: la última guardada y los cambios en vivo.
  useEffect(() => {
    if (!enCurso) return;
    let activo = true;
    obtenerUbicacionMecanico(servicio.id)
      .then((posicion) => {
        if (activo && posicion) setPosicionMecanico(posicion);
      })
      .catch((error: unknown) => console.warn('[MAPA] Ubicación del mecánico:', error));
    const desuscribir = suscribirseAUbicacionMecanico(servicio.id, setPosicionMecanico);
    return () => {
      activo = false;
      desuscribir();
    };
  }, [servicio.id, enCurso]);

  // El mecánico asignado comparte su posición mientras el servicio está en curso.
  useEffect(() => {
    if (!esAsignado || !enCurso) return;
    let detener: (() => void) | null = null;
    let activo = true;
    compartirUbicacionMecanico(servicio.id, (posicion) => {
      if (activo) setPosicionMecanico(posicion);
    })
      .then((parar) => {
        if (activo) detener = parar;
        else parar();
      })
      .catch((error: unknown) =>
        setErrorUbicacion(error instanceof Error ? error.message : 'No se pudo compartir tu ubicación.'),
      );
    return () => {
      activo = false;
      detener?.();
    };
  }, [servicio.id, esAsignado, enCurso]);

  // Fuera del servicio en curso no se muestra la posición del mecánico ni el error de compartirla.
  const posicionMecanico = enCurso ? posicionGuardada : null;
  const errorUbicacion = esAsignado && enCurso ? errorCompartir : null;

  const { latitud, longitud } = servicio.ubicacion;
  const cliente = useMemo<Coordenadas>(() => ({ latitud, longitud }), [latitud, longitud]);

  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const lista: MarcadorMapa[] = [{ id: 'cliente', ...cliente, tipo: 'cliente' }];
    if (posicionMecanico) lista.push({ id: 'mecanico', ...posicionMecanico, tipo: 'mecanico' });
    return lista;
  }, [cliente, posicionMecanico]);

  const viajando = !!posicionMecanico && VIAJANDO.includes(servicio.estado);

  // Recorrido por las calles del mecánico al cliente (RF-GPS-002). Se pide de nuevo solo si el
  // mecánico se movió bastante, para no consultar el servicio de rutas cada 5 segundos.
  const [rutaCalculada, setRutaCalculada] = useState<RutaCalculada | null>(null);
  useEffect(() => {
    if (!viajando || !posicionMecanico) return;
    if (
      rutaCalculada &&
      rutaCalculada.destino === cliente &&
      distanciaEntre(rutaCalculada.origen, posicionMecanico) < RECALCULAR_RUTA_METROS
    ) {
      return;
    }
    let activo = true;
    obtenerRuta(posicionMecanico, cliente).then((datos) => {
      if (activo) setRutaCalculada({ origen: posicionMecanico, destino: cliente, datos });
    });
    return () => {
      activo = false;
    };
  }, [viajando, posicionMecanico, cliente, rutaCalculada]);

  const ruta = viajando ? (rutaCalculada?.datos ?? null) : null;

  const linea = useMemo<Coordenadas[] | null>(() => {
    if (!viajando || !posicionMecanico) return null;
    // Sin ruta (todavía cargando o el servicio no respondió) se dibuja una recta.
    return ruta ? [posicionMecanico, ...ruta.puntos] : [posicionMecanico, cliente];
  }, [viajando, posicionMecanico, ruta, cliente]);

  const aviso = errorUbicacion
    ? errorUbicacion
    : enCurso && !posicionMecanico
      ? esAsignado
        ? 'Buscando tu ubicación…'
        : 'Esperando la ubicación del mecánico…'
      : ruta
        ? textoLlegada(ruta)
        : null;

  return (
    <Tarjeta testID="mapa-servicio" className="gap-2 overflow-hidden p-0">
      <MapaLeaflet
        marcadores={marcadores}
        centroInicial={cliente}
        zoomInicial={15}
        linea={linea}
        encuadrar
        altura={230}
      />
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3">
        <Text className="text-mini text-texto-tenue">🏍️ Cliente</Text>
        {servicio.mecanico_id ? <Text className="text-mini text-texto-tenue">🛠️ Mecánico</Text> : null}
        {aviso ? (
          <Text className={errorUbicacion ? 'text-mini text-peligro' : 'text-mini text-texto-tenue'}>{aviso}</Text>
        ) : null}
      </View>
    </Tarjeta>
  );
}
