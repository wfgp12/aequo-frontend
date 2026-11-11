import { requestAutenticado } from './autenticado';

/** Un mes (YYYY-MM) o un rango de fechas (YYYY-MM-DD, ambas incluidas). Sin periodo, el backend usa el mes actual. */
export type PeriodoReporte = { mes: string } | { desde: string; hasta: string };

/** Totales del periodo ya calculados por el backend; el frontend solo los muestra (RNF-11). */
export type ReportePeriodo = {
  desde: string;
  hasta: string;
  ingresos: number;
  egresos: number;
  pagosTarjeta: number;
  abonosDeuda: number;
  dineroRecibido: number;
  balance: number;
};

/** GET /reportes/periodo: se devuelve el cuerpo tal cual, sin redondear (el redondeo es al mostrar). */
export function obtenerReportePeriodo(periodo?: PeriodoReporte) {
  const consulta = new URLSearchParams(periodo);
  const texto = consulta.toString();
  return requestAutenticado<ReportePeriodo>(`/reportes/periodo${texto ? `?${texto}` : ''}`);
}
