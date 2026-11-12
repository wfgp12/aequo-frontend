import { obtenerReporteEvolucion, type PeriodoReporte } from '@/lib/api/reportes';
import { useReporte } from '@/lib/use-reporte';

const ERROR = 'No pudimos cargar la evolución de tu balance. Inténtalo de nuevo en unos minutos.';

// Función estable para el hook genérico; la evolución solo entiende rangos de meses, no un mes suelto
const obtener = (periodo?: PeriodoReporte) =>
  obtenerReporteEvolucion(periodo && 'desde' in periodo ? periodo : undefined);

/** El balance mes a mes del rango de meses (YYYY-MM) dado. */
export function useReporteEvolucion(periodo: { desde: string; hasta: string }) {
  return useReporte(obtener, ERROR, periodo);
}
