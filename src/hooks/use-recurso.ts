import { useCallback, useEffect, useState } from 'react';

type Recurso<T> = {
  datos: T;
  cargando: boolean;
  /** Mensaje del último error, o null si la última carga salió bien. */
  error: string | null;
  recargar: () => void;
};

/**
 * Consume una función de `/services` exponiendo el estado de carga (RNF-UX-003)
 * y el error, si lo hubo. Es el único puente entre las vistas y la capa de
 * datos: ninguna vista conoce el origen de los datos (RF-VIEW-012).
 *
 * Al recargar se conservan los datos anteriores, para que una actualización
 * en segundo plano no vacíe la pantalla.
 */
export function useRecurso<T>(
  cargar: () => Promise<T>,
  valorInicial: T,
  dependencias: unknown[] = [],
): Recurso<T> {
  const [datos, setDatos] = useState<T>(valorInicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
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
      .catch((causa: unknown) => {
        console.error('Error al cargar recurso:', causa);
        if (vigente) {
          setError(causa instanceof Error ? causa.message : 'No se pudieron cargar los datos.');
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [ejecutar]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => recargar(), [recargar]);

  return { datos, cargando, error, recargar };
}
