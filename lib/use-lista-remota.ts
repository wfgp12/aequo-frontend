import { esApi } from '@/lib/errores';
import { useEffect, useState } from 'react';

/** Cómo se le explica al usuario un fallo al cargar y si tiene sentido ofrecerle reintentar. */
export type Fallo = { mensaje: string; reintentar: boolean };

type Datos<T> = {
  /** Identifica la consulta a la que pertenecen estos datos (intento de recarga). */
  intento: number;
  items: T[];
  fallo: Fallo | null;
};

/**
 * Lista que se pide al backend al abrir la pantalla. `recargar` la vuelve a pedir: si ya había una lista se sigue
 * mostrando mientras llega la nueva (sin parpadeo); si lo último fue un fallo, se vuelve al indicador de carga.
 * `cargar` y `describirFallo` deben ser estables entre renders (funciones de módulo o `useCallback`).
 */
export function useListaRemota<T>(
  cargar: () => Promise<T[]>,
  describirFallo: (e: unknown) => Fallo,
) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<Datos<T> | null>(null);

  useEffect(() => {
    let activo = true;
    cargar()
      .then((items) => {
        if (activo) setDatos({ intento, items, fallo: null });
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio, se queda cargando
        if (activo && !esApi(e, 401)) setDatos({ intento, items: [], fallo: describirFallo(e) });
      });
    return () => {
      activo = false;
    };
  }, [cargar, describirFallo, intento]);

  const vigente = datos?.intento === intento;
  return {
    cargando: datos === null || (!vigente && datos.fallo !== null),
    items: datos?.items ?? [],
    fallo: vigente ? datos.fallo : null,
    recargar: () => setIntento((n) => n + 1),
  };
}
