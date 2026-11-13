import { requestAutenticado } from './autenticado';

export type TipoMeta = 'MONTO_FIJO' | 'PORCENTAJE';

export type MetaAhorro = {
  id: string;
  tipoMeta: TipoMeta;
  /** Pesos si es MONTO_FIJO; porcentaje (0 a 100, con decimales) si es PORCENTAJE. */
  valorObjetivo: number;
  /** Mes de la meta, YYYY-MM. */
  periodo: string;
  /** Lo calcula el sistema: la pantalla de la meta no lo envía. */
  ahorroReal: number;
  creadaEn: string;
  actualizadaEn: string;
};

/** GET /ahorro/metas de un solo mes: la meta de ese mes o null si todavía no hay. */
export async function obtenerMetaDelMes(mes: string): Promise<MetaAhorro | null> {
  const { items } = await requestAutenticado<{ items: MetaAhorro[] }>(
    `/ahorro/metas?desde=${mes}&hasta=${mes}`,
  );
  return items[0] ?? null;
}

/** Progreso del ahorro de un mes, tal como lo calcula el backend (no redondea ni tiene tope). */
export type ProgresoAhorro = {
  /** YYYY-MM */
  periodo: string;
  ingresoPropio: number;
  egresos: number;
  /** Ingresos propios menos egresos del mes: puede ser negativo. */
  ahorroDelMes: number;
  /** null si el mes no tiene meta. */
  meta: { id: string; tipoMeta: TipoMeta; valorObjetivo: number; montoMeta: number } | null;
  /** Ahorro del mes menos el monto de la meta: negativo = todavía falta. */
  disponible: number;
  /** null si no hay meta o si el monto de la meta es 0 (meta de porcentaje sin ingresos). */
  porcentajeAvance: number | null;
};

/** GET /ahorro/progreso del mes (YYYY-MM): todas las cifras vienen calculadas del backend. */
export function obtenerProgresoAhorro(mes: string) {
  return requestAutenticado<ProgresoAhorro>(`/ahorro/progreso?mes=${mes}`);
}

/**
 * POST /ahorro/metas: crea la meta de un mes (un 409 si ya existe una).
 * La clave (UUID) identifica la acción del usuario: un reintento la reutiliza y el backend no crea otra.
 */
export function crearMeta(
  datos: { tipoMeta: TipoMeta; valorObjetivo: number; periodo: string },
  claveIdempotencia: string,
) {
  return requestAutenticado<MetaAhorro>('/ahorro/metas', {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** PATCH /ahorro/metas/:id: el tipo y el valor van siempre juntos. Repetirlo es inofensivo, no lleva clave. */
export function actualizarMeta(id: string, datos: { tipoMeta: TipoMeta; valorObjetivo: number }) {
  return requestAutenticado<MetaAhorro>(`/ahorro/metas/${id}`, { method: 'PATCH', body: datos });
}

/** DELETE /ahorro/metas/:id: responde 204 sin cuerpo (un 409 si la meta ya tiene ahorro registrado). */
export async function eliminarMeta(id: string) {
  await requestAutenticado<null>(`/ahorro/metas/${id}`, { method: 'DELETE' });
}
