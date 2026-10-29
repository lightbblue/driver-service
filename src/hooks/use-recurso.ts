import { useCallback, useEffect, useState } from 'react';

type Recurso<T> = {
  datos: T;
  cargando: boolean;
  /** Mensaje del último error de carga, o null si salió bien. */
  error: string | null;
  recargar: () => void;
};

/**
 * Consume una función de `/services` exponiendo el estado de carga y de error (RNF-UX-003).
 * Es el único puente entre las vistas y la capa de datos: ninguna vista conoce el origen.
 */
export function useRecurso<T>(
  cargar: () => Promise<T>,
  valorInicial: T,
  dependencias: unknown[] = [],
): Recurso<T> {
  const [datos, setDatos] = useState<T>(valorInicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Las dependencias las define quien llama, igual que en useEffect.
  // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
  const ejecutar = useCallback(cargar, dependencias);

  const recargar = useCallback(() => {
    let vigente = true;
    setCargando(true);

    ejecutar()
      .then((resultado) => {
        if (!vigente) return;
        setDatos(resultado);
        setError(null);
      })
      .catch((motivo: unknown) => {
        if (!vigente) return;
        setDatos(valorInicial);
        setError(motivo instanceof Error ? motivo.message : 'No se pudieron cargar los datos.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejecutar]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => recargar(), [recargar]);

  return { datos, cargando, error, recargar };
}
