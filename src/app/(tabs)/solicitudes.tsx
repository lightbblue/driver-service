import { Proximamente } from '@/components/ui/proximamente';

/** Pantalla SHOULD de la Entrega 1: fuera del alcance comprometido. */
export default function SolicitudesScreen() {
  return (
    <Proximamente
      titulo="Mis solicitudes"
      requisito="RF-VIEW-009 · SHOULD"
      detalle="El historial de solicitudes se implementa si queda capacidad en el sprint, después de las cinco pantallas MUST."
    />
  );
}
