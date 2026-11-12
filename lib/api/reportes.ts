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

/** Un gasto por categoría ya calculado por el backend; `categoriaId` es null en "Sin categoría". */
export type CategoriaGasto = {
  categoriaId: string | null;
  nombre: string;
  total: number;
  /** Porcentaje del total de egresos del periodo, ya calculado por el backend. */
  porcentaje: number;
};

/** Egresos del periodo por categoría, en el orden que manda el backend (RNF-11). */
export type ReporteCategorias = {
  desde: string;
  hasta: string;
  total: number;
  categorias: CategoriaGasto[];
};

/** Balance de un mes (YYYY-MM) ya calculado por el backend; el frontend solo lo presenta (RNF-11). */
export type PuntoEvolucion = {
  periodo: string;
  balance: number;
};

/** Balance mes a mes, en el orden que manda el backend; `desde` y `hasta` son null si no hay movimientos ni rango. */
export type ReporteEvolucion = {
  desde: string | null;
  hasta: string | null;
  puntos: PuntoEvolucion[];
};

/** Ruta del reporte con la consulta del periodo (sin periodo, el backend usa el mes actual). */
function rutaReporte(ruta: string, periodo?: Record<string, string>) {
  const texto = new URLSearchParams(periodo).toString();
  return `${ruta}${texto ? `?${texto}` : ''}`;
}

/** GET /reportes/periodo: se devuelve el cuerpo tal cual, sin redondear (el redondeo es al mostrar). */
export function obtenerReportePeriodo(periodo?: PeriodoReporte) {
  return requestAutenticado<ReportePeriodo>(rutaReporte('/reportes/periodo', periodo));
}

/** GET /reportes/categorias: se devuelve el cuerpo tal cual, sin reordenar ni recalcular. */
export function obtenerReporteCategorias(periodo?: PeriodoReporte) {
  return requestAutenticado<ReporteCategorias>(rutaReporte('/reportes/categorias', periodo));
}

/** GET /reportes/evolucion con meses YYYY-MM: solo se envían los extremos definidos; el cuerpo llega tal cual. */
export function obtenerReporteEvolucion(periodo: { desde?: string; hasta?: string } = {}) {
  const extremos = Object.fromEntries(
    Object.entries(periodo).filter((par): par is [string, string] => par[1] !== undefined),
  );
  return requestAutenticado<ReporteEvolucion>(rutaReporte('/reportes/evolucion', extremos));
}
