import type { Categoria, TipoMovimiento } from './categorias';
import { requestAutenticado } from './autenticado';

/** Métodos de pago que acepta POST /transacciones. La tarjeta de crédito se registra en el módulo de tarjetas. */
export type MetodoPago = 'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA';

/** Los movimientos que llegan del backend pueden venir de una compra con tarjeta de crédito (módulo de tarjetas). */
export type MetodoPagoRegistrado = MetodoPago | 'TARJETA_CREDITO';

export type NuevaTransaccion = {
  tipo: TipoMovimiento;
  /** Pesos colombianos, mayor que cero. */
  monto: number;
  /** Fecha sin hora ni zona horaria, en formato YYYY-MM-DD. */
  fecha: string;
  categoriaId: string;
  metodoPago: MetodoPago;
  /** Opcional, máximo 200 caracteres. */
  descripcion?: string;
};

export type Transaccion = Required<NuevaTransaccion> & {
  id: string;
  clasificacionFlujo: 'ORDINARIO';
  creadaEn: string;
  categoria?: Pick<Categoria, 'id' | 'nombre' | 'tipo' | 'esPredeterminada'> | null;
};

export const MAX_DESCRIPCION = 200;

/**
 * POST /transacciones: el tipo lo fija el botón con el que se inició el registro.
 * La clave (UUID) identifica la acción del usuario: un reintento la reutiliza y el backend no crea un segundo movimiento.
 */
export function crearTransaccion(datos: NuevaTransaccion, claveIdempotencia: string) {
  return requestAutenticado<Transaccion>('/transacciones', {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

export type FiltrosTransacciones = {
  /** Fecha inicial, incluida (YYYY-MM-DD). */
  desde?: string;
  /** Fecha final, incluida (YYYY-MM-DD). */
  hasta?: string;
  limite?: number;
  /** Cursor opaco que devolvió la página anterior. */
  cursor?: string;
};

export type PaginaDeTransacciones = {
  items: TransaccionListada[];
  /** null cuando ya no hay más páginas. */
  siguienteCursor: string | null;
};

/** Un movimiento tal como lo lista GET /transacciones. */
export type TransaccionListada = Omit<Transaccion, 'metodoPago'> & {
  metodoPago: MetodoPagoRegistrado;
};

/**
 * GET /transacciones: más recientes primero (fecha descendente), con carga progresiva por cursor.
 * El cursor es opaco: se devuelve tal cual, sin interpretarlo.
 */
export function listarTransacciones(filtros: FiltrosTransacciones = {}) {
  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') consulta.set(clave, String(valor));
  }
  const texto = consulta.toString();
  return requestAutenticado<PaginaDeTransacciones>(`/transacciones${texto ? `?${texto}` : ''}`);
}
