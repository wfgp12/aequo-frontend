import type { TipoMovimiento } from './api/categorias';
import type { MetodoPago } from './api/transacciones';

export type OpcionDeMetodo = { etiqueta: string; valor: MetodoPago | 'TARJETA_CREDITO' };

const OPCIONES: OpcionDeMetodo[] = [
  { etiqueta: 'Efectivo', valor: 'EFECTIVO' },
  { etiqueta: 'Tarjeta débito', valor: 'DEBITO' },
  { etiqueta: 'Tarjeta crédito', valor: 'TARJETA_CREDITO' },
  { etiqueta: 'Transferencia', valor: 'TRANSFERENCIA' },
];

/** Opciones del selector: la tarjeta de crédito solo aplica a los egresos. */
export function opcionesDeMetodo(tipo: TipoMovimiento) {
  return tipo === 'EGRESO' ? OPCIONES : OPCIONES.filter((o) => o.valor !== 'TARJETA_CREDITO');
}

/** Al editar un movimiento no se puede pasar a tarjeta: una compra con tarjeta no es un movimiento. */
export const AVISO_TARJETA_AL_EDITAR =
  'Las compras con tarjeta de crédito se registran desde «Registrar egreso». Aquí elige otro método.';
