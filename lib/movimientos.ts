import { ApiError, NetworkError } from './api/client';
import type { Categoria, TipoMovimiento } from './api/categorias';
import { formatearPesos } from './dinero';
import type {
  CambiosDeTransaccion,
  MetodoPago,
  MetodoPagoRegistrado,
  TransaccionListada,
} from './api/transacciones';

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

/** Estado del formulario de la hoja "Editar movimiento". */
export type FormularioMovimiento = {
  tipo: TipoMovimiento;
  /** Monto en pesos, solo dígitos. */
  valor: string;
  /** null mientras el usuario no elige una del tipo nuevo. */
  categoria: Pick<Categoria, 'id' | 'nombre' | 'tipo' | 'esPredeterminada'> | null;
  metodo: MetodoPagoRegistrado;
  /** YYYY-MM-DD */
  fecha: string;
  descripcion: string;
};

export function formularioDesde(item: TransaccionListada): FormularioMovimiento {
  return {
    tipo: item.tipo,
    valor: String(Math.round(item.monto)),
    categoria: item.categoria ?? null,
    metodo: item.metodoPago,
    fecha: item.fecha,
    descripcion: item.descripcion,
  };
}

/**
 * Solo los campos que cambiaron respecto del movimiento original, como pide PATCH /transacciones/:id.
 * Si cambió el tipo, siempre se envía también la categoría (del tipo nuevo).
 */
export function cambiosDelFormulario(
  original: TransaccionListada,
  f: FormularioMovimiento,
): CambiosDeTransaccion {
  const cambios: CambiosDeTransaccion = {};
  const tipoCambio = f.tipo !== original.tipo;
  if (tipoCambio) cambios.tipo = f.tipo;
  if (Number(f.valor) !== Math.round(original.monto)) cambios.monto = Number(f.valor);
  if (f.fecha !== original.fecha) cambios.fecha = f.fecha;
  if (f.categoria && (tipoCambio || f.categoria.id !== original.categoriaId)) {
    cambios.categoriaId = f.categoria.id;
  }
  // El selector no ofrece la tarjeta de crédito, así que un método distinto siempre es uno de los tres que acepta el backend
  if (f.metodo !== original.metodoPago) cambios.metodoPago = f.metodo as MetodoPago;
  if (f.descripcion.trim() !== original.descripcion) cambios.descripcion = f.descripcion.trim();
  return cambios;
}

export function avisoDeCategoria(tipo: TipoMovimiento) {
  return `Elige una categoría de ${tipo === 'INGRESO' ? 'ingreso' : 'egreso'} para guardar.`;
}

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
const SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

function estado(e: unknown) {
  return e instanceof ApiError ? e.status : null;
}

export function mensajeAlGuardar(e: unknown) {
  if (e instanceof NetworkError) return SIN_CONEXION;
  if (estado(e) === 404) return 'Este movimiento ya no existe.';
  if (estado(e) === 409) {
    return 'Este movimiento viene de tarjetas o deudas y no se puede cambiar aquí.';
  }
  return 'No pudimos guardar los cambios. Revisa los datos e inténtalo de nuevo.';
}

export function mensajeAlEliminar(e: unknown) {
  if (e instanceof NetworkError) return SIN_CONEXION;
  if (estado(e) === 409) {
    return 'Este movimiento viene de tarjetas o deudas y no se puede eliminar aquí.';
  }
  return 'No pudimos eliminar el movimiento. Inténtalo de nuevo en unos minutos.';
}
