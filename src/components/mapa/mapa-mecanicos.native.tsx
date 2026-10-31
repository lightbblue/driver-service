import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';

import { COLORES } from '@/lib/tema';
import type { Mecanico } from '@/types';

export type MapaMecanicosProps = {
  mecanicos: Mecanico[];
  ubicacionUsuario: { latitud: number; longitud: number } | null;
  mecanicoSeleccionado: Mecanico | null;
  onSeleccionarMecanico: (mecanico: Mecanico) => void;
  regionInicial: Region;
};

/**
 * Componente nativo del mapa para iOS y Android utilizando `react-native-maps`.
 * Renderiza los marcadores interactivos de los talleres y la posición del usuario.
 */
export const MapaMecanicos = forwardRef<MapView, MapaMecanicosProps>(function MapaMecanicos(
  {
    mecanicos,
    ubicacionUsuario,
    mecanicoSeleccionado,
    onSeleccionarMecanico,
    regionInicial,
  },
  ref,
) {
  return (
    <View style={styles.contenedor}>
      <MapView
        ref={ref}
        provider={PROVIDER_DEFAULT}
        style={styles.mapa}
        initialRegion={regionInicial}
        showsUserLocation={true}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Marcador de la posición del usuario — punto amarillo sobre el azul nativo */}
        {ubicacionUsuario ? (
          <Marker
            coordinate={{
              latitude: ubicacionUsuario.latitud,
              longitude: ubicacionUsuario.longitud,
            }}
            title="Mi ubicación"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
          >
            <View style={styles.pinUsuarioExterior}>
              <View style={styles.pinUsuarioInterior}>
                <Ionicons name="navigate" size={14} color={COLORES.textoInverso} />
              </View>
            </View>
          </Marker>
        ) : null}

        {/* Marcadores de los mecánicos cercanos */}
        {mecanicos.map((mecanico) => {
          const estaSeleccionado = mecanicoSeleccionado?.id === mecanico.id;

          return (
            <Marker
              key={mecanico.id}
              coordinate={{
                latitude: mecanico.latitud,
                longitude: mecanico.longitud,
              }}
              title={mecanico.nombre_taller}
              onPress={() => onSeleccionarMecanico(mecanico)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.marcadorContenedor}>
                <View
                  style={[
                    styles.pinMecanico,
                    estaSeleccionado ? styles.pinSeleccionado : styles.pinNormal,
                  ]}
                >
                  <Ionicons
                    name="construct"
                    size={estaSeleccionado ? 19 : 16}
                    color={estaSeleccionado ? COLORES.textoInverso : COLORES.acento}
                  />
                  {mecanico.disponible ? <View style={styles.indicadorDisponible} /> : null}
                </View>

                {/* Flecha inferior del pin */}
                <View
                  style={[
                    styles.flechaPin,
                    estaSeleccionado ? styles.flechaSeleccionada : styles.flechaNormal,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapa: {
    width: '100%',
    height: '100%',
  },
  pinUsuarioExterior: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORES.acento}40`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORES.acento,
  },
  pinUsuarioInterior: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORES.acento,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marcadorContenedor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinMecanico: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: COLORES.fondo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  pinNormal: {
    backgroundColor: COLORES.superficieAlta,
    borderColor: COLORES.acento,
  },
  pinSeleccionado: {
    backgroundColor: COLORES.acento,
    borderColor: COLORES.texto,
    transform: [{ scale: 1.15 }],
  },
  indicadorDisponible: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORES.exito,
    borderWidth: 1.5,
    borderColor: COLORES.superficieAlta,
  },
  flechaPin: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  flechaNormal: {
    borderTopColor: COLORES.acento,
  },
  flechaSeleccionada: {
    borderTopColor: COLORES.texto,
  },
});

