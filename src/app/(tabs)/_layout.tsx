import Tabs from 'expo-router/js-tabs';

import { BarraInferior } from '@/components/navegacion/barra-inferior';

/** Contenedor de las pestañas. La barra es propia porque la maqueta lleva el SOS central. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BarraInferior {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#0B0B0D' } }}>
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="solicitudes" options={{ title: 'Solicitudes' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
