import { obtenerReportePeriodo } from '@/lib/api/reportes';
import { useReporte } from '@/lib/use-reporte';

const ERROR = 'No pudimos cargar tus ingresos y egresos. Inténtalo de nuevo en unos minutos.';

/** Los totales del periodo (un mes, un rango o, sin nada, el mes actual). */
export function useReportePeriodo(periodo: { mes?: string; desde?: string; hasta?: string }) {
  return useReporte(obtenerReportePeriodo, ERROR, periodo);
}
