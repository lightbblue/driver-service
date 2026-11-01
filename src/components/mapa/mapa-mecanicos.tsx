import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';

import type { Mecanico } from '@/types';

import type { Coordenadas, MapaLeafletRef, MarcadorMapa } from './mapa-escena';
import { MapaLeaflet } from './mapa-leaflet';

/** Región al estilo de los mapas nativos: centro y amplitud en grados. */
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapaMecanicosRef = {
  animateToRegion: (region: Region) => void;
};

export type MapaMecanicosProps = {
  mecanicos: Mecanico[];
  ubicacionUsuario: Coordenadas | null;
  mecanicoSeleccionado: Mecanico | null;
  onSeleccionarMecanico: (mecanico: Mecanico) => void;
  regionInicial: Region;
};

const ID_USUARIO = 'yo';

/** Zoom de Leaflet equivalente a una amplitud en grados. */
function zoomDe(delta: number): number {
  return Math.min(18, Math.max(3, Math.round(Math.log2(360 / delta))));
}

/** Mapa de talleres (RF-VIEW-007) sobre el mapa Leaflet único de la app. */
export const MapaMecanicos = forwardRef<MapaMecanicosRef, MapaMecanicosProps>(function MapaMecanicos(
  { mecanicos, ubicacionUsuario, mecanicoSeleccionado, onSeleccionarMecanico, regionInicial },
  ref,
) {
  const mapaRef = useRef<MapaLeafletRef>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region) =>
      mapaRef.current?.volarA({ latitud: region.latitude, longitud: region.longitude }, zoomDe(region.latitudeDelta)),
  }));

  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const talleres: MarcadorMapa[] = mecanicos.map((m) => ({
      id: m.id,
      latitud: m.latitud,
      longitud: m.longitud,
      tipo: m.id === mecanicoSeleccionado?.id ? 'taller-elegido' : m.disponible ? 'taller' : 'taller-off',
    }));
    return ubicacionUsuario
      ? [...talleres, { id: ID_USUARIO, ...ubicacionUsuario, tipo: 'yo' }]
      : talleres;
  }, [mecanicos, mecanicoSeleccionado, ubicacionUsuario]);

  const tocar = useCallback(
    (id: string) => {
      const mecanico = mecanicos.find((m) => m.id === id);
      if (mecanico) onSeleccionarMecanico(mecanico);
    },
    [mecanicos, onSeleccionarMecanico],
  );

  return (
    <MapaLeaflet
      ref={mapaRef}
      marcadores={marcadores}
      centroInicial={{ latitud: regionInicial.latitude, longitud: regionInicial.longitude }}
      zoomInicial={zoomDe(regionInicial.latitudeDelta)}
      onTocarMarcador={tocar}
    />
  );
});
