import type { Categoria, TipoMovimiento } from './categorias';
import { requestAutenticado } from './autenticado';

/** Métodos de pago que acepta POST /transacciones. La tarjeta de crédito se registra en el módulo de tarjetas. */
export type MetodoPago = 'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA';

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
