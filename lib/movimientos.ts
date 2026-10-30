import { formatearPesos } from './dinero';
import type { MetodoPagoRegistrado, TransaccionListada } from './api/transacciones';

export type SeccionDeDia = { fecha: string; data: TransaccionListada[] };

/** Agrupa por día respetando el orden recibido (el backend ya entrega fecha descendente). */
export function agruparPorDia(items: TransaccionListada[]): SeccionDeDia[] {
  const secciones: SeccionDeDia[] = [];
  for (const item of items) {
    const ultima = secciones[secciones.length - 1];
    if (ultima?.fecha === item.fecha) ultima.data.push(item);
    else secciones.push({ fecha: item.fecha, data: [item] });
  }
  return secciones;
}

export const ETIQUETA_METODO: Record<MetodoPagoRegistrado, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  TRANSFERENCIA: 'Transferencia',
};

/** "− $ 45.000" para un egreso y "+ $ 3.400.000" para un ingreso. */
export function montoConSigno(item: Pick<TransaccionListada, 'tipo' | 'monto'>) {
  return `${item.tipo === 'INGRESO' ? '+' : '−'} $ ${formatearPesos(item.monto)}`;
}

/** Título de la fila: la nota si la hay; si no, la categoría. */
export function tituloDelMovimiento(item: TransaccionListada) {
  return item.descripcion || item.categoria?.nombre || 'Sin categoría';
}

/** Subtítulo: "Categoría · Método"; sin nota, el título ya es la categoría y solo queda el método. */
export function subtituloDelMovimiento(item: TransaccionListada) {
  const metodo = ETIQUETA_METODO[item.metodoPago];
  return item.descripcion && item.categoria ? `${item.categoria.nombre} · ${metodo}` : metodo;
}
