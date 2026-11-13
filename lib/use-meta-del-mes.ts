import { obtenerMetaDelMes, type MetaAhorro } from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useEffect, useState } from 'react';

type Datos = {
  /** Identifica la consulta a la que pertenecen estos datos (mes e intento de recarga). */
  clave: string;
  meta: MetaAhorro | null;
  error: string | null;
};

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown) {
  return e instanceof NetworkError
    ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    : 'No pudimos cargar tu meta de ahorro. Inténtalo de nuevo en unos minutos.';
}

/** La meta de ahorro de un mes (null si todavía no hay), con su estado de carga y error y la opción de reintentar. */
export function useMetaDelMes(mes: string) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);

  const clave = `${mes}|${intento}`;
  // Los datos son de otra consulta (o aún no hay ninguno): se está cargando
  const vigente = datos?.clave === clave ? datos : null;

  useEffect(() => {
    let activo = true;
    obtenerMetaDelMes(mes)
      .then((meta) => {
        if (activo) setDatos({ clave, meta, error: null });
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio, se queda cargando
        if (activo && !(e instanceof ApiError && e.status === 401))
          setDatos({ clave, meta: null, error: mensajeDeError(e) });
      });
    return () => {
      activo = false;
    };
  }, [clave, mes]);

  return {
    cargando: vigente === null,
    meta: vigente?.meta ?? null,
    error: vigente?.error ?? null,
    recargar: () => setIntento((n) => n + 1),
  };
}
