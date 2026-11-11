import { obtenerReporteCategorias } from '@/lib/api/reportes';
import { useReporte } from '@/lib/use-reporte';

const ERROR = 'No pudimos cargar tus egresos por categoría. Inténtalo de nuevo en unos minutos.';

/** Los egresos del periodo por categoría (un mes, un rango o, sin nada, el mes actual). */
export function useReporteCategorias(periodo: { mes?: string; desde?: string; hasta?: string }) {
  return useReporte(obtenerReporteCategorias, ERROR, periodo);
}
