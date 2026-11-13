import { obtenerProgresoAhorro, type ProgresoAhorro } from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useEffect, useState } from 'react';

type Datos = {
  /** Identifica la consulta a la que pertenecen estos datos (mes e intento de recarga). */
  clave: string;
  progreso: ProgresoAhorro | null;
  error: string | null;
};

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown) {
  return e instanceof NetworkError
    ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    : 'No pudimos cargar tu progreso de ahorro. Inténtalo de nuevo en unos minutos.';
}

/**
 * El progreso del ahorro de un mes, con su estado de carga y error. `recargar` lo pide de nuevo (reintento o
 * después de cambiar la meta) y mientras llega no se ven las cifras viejas.
 */
export function useProgresoAhorro(mes: string) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);

  const clave = `${mes}|${intento}`;
  // Los datos son de otra consulta (o aún no hay ninguno): se está cargando
  const vigente = datos?.clave === clave ? datos : null;

  useEffect(() => {
    let activo = true;
    obtenerProgresoAhorro(mes)
      .then((progreso) => {
        if (activo) setDatos({ clave, progreso, error: null });
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio, se queda cargando
        if (activo && !(e instanceof ApiError && e.status === 401))
          setDatos({ clave, progreso: null, error: mensajeDeError(e) });
      });
    return () => {
      activo = false;
    };
  }, [clave, mes]);

  return {
    cargando: vigente === null,
    progreso: vigente?.progreso ?? null,
    error: vigente?.error ?? null,
    recargar: () => setIntento((n) => n + 1),
  };
}
