import Tabs from 'expo-router/js-tabs';

import { BarraInferior } from '@/components/navegacion/barra-inferior';
import { RequiereSesion } from '@/components/navegacion/requiere-sesion';
import { COLORES } from '@/lib/tema';

/** Contenedor de las pestañas. La barra es propia porque la maqueta lleva el SOS central. */
export default function TabsLayout() {
  return (
    <RequiereSesion>
      <Tabs
        tabBar={(props) => <BarraInferior {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLORES.fondo } }}>
        <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
        <Tabs.Screen name="solicitudes" options={{ title: 'Solicitudes' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      </Tabs>
    </RequiereSesion>
  );
}
