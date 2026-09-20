import { useCallback, useEffect, useState } from 'react';

type Recurso<T> = {
  datos: T;
  cargando: boolean;
  recargar: () => void;
};

/**
 * Consume una función de `/services` exponiendo el estado de carga (RNF-UX-003).
 * Es el único puente entre las vistas y la capa de datos: ninguna vista importa
 * un JSON ni conoce su origen (RF-VIEW-012).
 */
export function useRecurso<T>(
  cargar: () => Promise<T>,
  valorInicial: T,
  dependencias: unknown[] = [],
): Recurso<T> {
  const [datos, setDatos] = useState<T>(valorInicial);
  const [cargando, setCargando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(cargar, dependencias);

  const recargar = useCallback(() => {
    let vigente = true;
    setCargando(true);

    ejecutar()
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch(() => {
        if (vigente) setDatos(valorInicial);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejecutar]);

  useEffect(() => recargar(), [recargar]);

  return { datos, cargando, recargar };
}
