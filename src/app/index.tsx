import { Redirect } from 'expo-router';

/** Punto de entrada: la aplicación abre en el inicio de sesión (RF-VIEW-002). */
export default function Entrada() {
  return <Redirect href="/login" />;
}
