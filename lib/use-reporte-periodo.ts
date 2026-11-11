import { ApiError, NetworkError } from '@/lib/api/client';
import {
  obtenerReportePeriodo,
  type PeriodoReporte,
  type ReportePeriodo,
} from '@/lib/api/reportes';
import { useEffect, useState } from 'react';

type Datos = {
  /** Identifica la consulta a la que pertenecen estos datos (periodo e intento de recarga). */
  clave: string;
  reporte: ReportePeriodo | null;
  error: string | null;
};

/** Los totales del periodo (un mes, un rango o, sin nada, el mes actual). Ignora respuestas de periodos viejos. */
export function useReportePeriodo({
  mes,
  desde,
  hasta,
}: {
  mes?: string;
  desde?: string;
  hasta?: string;
}) {
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<Datos | null>(null);

  const clave = `${mes ?? ''}|${desde ?? ''}|${hasta ?? ''}|${intento}`;
  // Los datos son de otra consulta (o aún no hay ninguno): se está cargando
  const vigente = datos?.clave === clave ? datos : null;

  useEffect(() => {
    let activo = true;
    const periodo: PeriodoReporte | undefined = mes
      ? { mes }
      : desde && hasta
        ? { desde, hasta }
        : undefined;
    obtenerReportePeriodo(periodo)
      .then((reporte) => {
        if (activo) setDatos({ clave, reporte, error: null });
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio. Los demás fallos se explican (RNF-04).
        if (!activo) return;
        const error =
          e instanceof ApiError && e.status === 401
            ? null
            : e instanceof NetworkError
              ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
              : 'No pudimos cargar tus ingresos y egresos. Inténtalo de nuevo en unos minutos.';
        setDatos({ clave, reporte: null, error });
      });
    return () => {
      activo = false;
    };
  }, [clave, mes, desde, hasta]);

  return {
    reporte: vigente?.reporte ?? null,
    cargando: vigente === null,
    error: vigente?.error ?? null,
    reintentar: () => setIntento((n) => n + 1),
  };
}
