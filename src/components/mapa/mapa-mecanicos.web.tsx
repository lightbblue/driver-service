import 'leaflet/dist/leaflet.css';

import type * as Leaflet from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Mecanico } from '@/types';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapaMecanicosProps = {
  mecanicos: Mecanico[];
  ubicacionUsuario: { latitud: number; longitud: number } | null;
  mecanicoSeleccionado: Mecanico | null;
  onSeleccionarMecanico: (mecanico: Mecanico) => void;
  regionInicial: Region;
};

const TESELAS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; OpenStreetMap contributors';

/**
 * Componente del mapa para la versión Web utilizando Leaflet (OpenStreetMap).
 */
export const MapaMecanicos = forwardRef<any, MapaMecanicosProps>(function MapaMecanicos(
  {
    mecanicos,
    ubicacionUsuario,
    mecanicoSeleccionado,
    onSeleccionarMecanico,
    regionInicial,
  },
  ref,
) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const marcadoresRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const marcadorUsuarioRef = useRef<Leaflet.Marker | null>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      if (mapaRef.current) {
        mapaRef.current.flyTo([region.latitude, region.longitude], 14, { duration: 1 });
      }
    },
  }));

  useEffect(() => {
    let cancelado = false;

    async function init() {
      const L = await import('leaflet');
      if (cancelado || !contenedorRef.current) return;

      const centro: Leaflet.LatLngTuple = [
        regionInicial.latitude,
        regionInicial.longitude,
      ];
      const mapa = L.map(contenedorRef.current).setView(centro, 13);
      L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mapa);
      mapaRef.current = mapa;

      setTimeout(() => mapa.invalidateSize(), 200);
    }

    void init();

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, []);

  // Actualizar marcadores de mecánicos
  useEffect(() => {
    async function actualizar() {
      if (!mapaRef.current) return;
      const L = await import('leaflet');

      // Limpiar marcadores anteriores
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current.clear();

      mecanicos.forEach((mec) => {
        const esSeleccionado = mecanicoSeleccionado?.id === mec.id;
        const color = esSeleccionado ? '#FFC107' : '#1F1F25';
        const colorIcono = esSeleccionado ? '#0B0B0D' : '#FFC107';

        const icono = L.divIcon({
          className: 'custom-mecanico-pin',
          html: `
            <div style="background-color: ${color}; width: 34px; height: 34px; border-radius: 17px; border: 2px solid ${
            esSeleccionado ? '#FFF' : '#FFC107'
          }; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: pointer;">
              <span style="color: ${colorIcono}; font-weight: bold; font-size: 16px;">🔧</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        const marcador = L.marker([mec.latitud, mec.longitud], { icon: icono })
          .addTo(mapaRef.current!)
          .on('click', () => onSeleccionarMecanico(mec));

        marcadoresRef.current.set(mec.id, marcador);
      });
    }

    void actualizar();
  }, [mecanicos, mecanicoSeleccionado, onSeleccionarMecanico]);

  // Actualizar marcador de usuario
  useEffect(() => {
    async function actualizarUsuario() {
      if (!mapaRef.current || !ubicacionUsuario) return;
      const L = await import('leaflet');

      if (marcadorUsuarioRef.current) {
        marcadorUsuarioRef.current.setLatLng([
          ubicacionUsuario.latitud,
          ubicacionUsuario.longitud,
        ]);
      } else {
        const icono = L.divIcon({
          className: 'custom-user-pin',
          html: `
            <div style="background-color: rgba(255,193,7,0.3); width: 28px; height: 28px; border-radius: 14px; border: 2px solid #FFC107; display: flex; align-items: center; justify-content: center;">
              <div style="background-color: #FFC107; width: 12px; height: 12px; border-radius: 6px;"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        marcadorUsuarioRef.current = L.marker(
          [ubicacionUsuario.latitud, ubicacionUsuario.longitud],
          { icon: icono },
        ).addTo(mapaRef.current);
      }
    }

    void actualizarUsuario();
  }, [ubicacionUsuario]);

  return (
    <View style={styles.contenedor}>
      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

