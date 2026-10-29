import { NetworkError } from '@/lib/api/client';
import { listarTransacciones, type TransaccionListada } from '@/lib/api/transacciones';
import { useCallback, useEffect, useRef, useState } from 'react';

type Filtros = { desde?: string; hasta?: string };

type Datos = {
  /** Identifica la consulta a la que pertenecen estos datos (filtros e intento de recarga). */
  clave: string;
  items: TransaccionListada[];
  siguienteCursor: string | null;
  error: string | null;
  errorAlCargarMas: string | null;
};

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown, queCargaba: string) {
  return e instanceof NetworkError
    ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    : `No pudimos cargar ${queCargaba}. Inténtalo de nuevo en unos minutos.`;
}

// Lo que ve la pantalla de una consulta: vacío mientras carga la primera página
function vista(vigente: Datos | null) {
  return {
    items: vigente?.items ?? [],
    cargando: vigente === null,
    error: vigente?.error ?? null,
    hayMas: Boolean(vigente?.siguienteCursor),
    errorAlCargarMas: vigente?.errorAlCargarMas ?? null,
  };
}

/**
 * Lista progresiva de movimientos: la primera página al abrir o al cambiar los filtros, y las siguientes
 * con cargarMas() usando el cursor opaco del backend, hasta que ya no haya más.
 */
export function useMovimientos({ desde, hasta }: Filtros) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const cargandoMasEnVuelo = useRef(false);

  const clave = `${desde ?? ''}|${hasta ?? ''}|${intento}`;
  // Los datos son de otra consulta (o aún no hay ninguno): se está cargando la primera página
  const vigente = datos?.clave === clave ? datos : null;

  useEffect(() => {
    let activo = true;
    listarTransacciones({ desde, hasta })
      .then((pagina) => {
        if (activo)
          setDatos({
            clave,
            items: pagina.items,
            siguienteCursor: pagina.siguienteCursor,
            error: null,
            errorAlCargarMas: null,
          });
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
        if (activo)
          setDatos({
            clave,
            items: [],
            siguienteCursor: null,
            error: mensajeDeError(e, 'tus movimientos'),
            errorAlCargarMas: null,
          });
      });
    return () => {
      activo = false;
    };
  }, [clave, desde, hasta]);

  const cargarMas = useCallback(async () => {
    if (!vigente?.siguienteCursor || cargandoMasEnVuelo.current) return;
    cargandoMasEnVuelo.current = true;
    setCargandoMas(true);
    try {
      const pagina = await listarTransacciones({ desde, hasta, cursor: vigente.siguienteCursor });
      setDatos((d) =>
        d?.clave === clave
          ? {
              ...d,
              items: [...d.items, ...pagina.items],
              siguienteCursor: pagina.siguienteCursor,
              errorAlCargarMas: null,
            }
          : d,
      );
    } catch (e) {
      setDatos((d) =>
        d?.clave === clave ? { ...d, errorAlCargarMas: mensajeDeError(e, 'más movimientos') } : d,
      );
    } finally {
      cargandoMasEnVuelo.current = false;
      setCargandoMas(false);
    }
  }, [vigente, desde, hasta, clave]);

  return {
    ...vista(vigente),
    cargandoMas,
    cargarMas,
    recargar: () => setIntento((n) => n + 1),
  };
}
