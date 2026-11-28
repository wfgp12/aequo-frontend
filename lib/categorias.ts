import type { TipoMovimiento } from '@/lib/api/categorias';
import {
  esCaso,
  mensajeAlCambiar,
  mensajeDeFallo,
  textoEnProceso,
  tieneCodigo,
} from '@/lib/errores';
import type { Lectura } from '@/lib/use-guardar-hoja';

// Reglas de presentación de las categorías: qué se valida antes de llamar al backend y cómo se le explica cada
// cosa al usuario en lenguaje cotidiano (RNF-04).

const MAX_NOMBRE = 40;

export function leerNombre(nombre: string): Lectura<{ nombre: string }> {
  const limpio = nombre.trim();
  if (limpio === '') return { error: 'Escribe un nombre para la categoría.' };
  if (limpio.length > MAX_NOMBRE) return { error: 'El nombre puede tener hasta 40 letras.' };
  return { datos: { nombre: limpio } };
}

export function mensajeAlGuardarCategoria(e: unknown) {
  if (tieneCodigo(e, 'IDEMPOTENCIA_EN_PROCESO')) return textoEnProceso('categoría');
  if (esCaso(e, 409, 'CATEGORIA_DUPLICADA'))
    return 'Ya existe una categoría con ese nombre. Prueba con otro.';
  return mensajeAlCambiar(
    e,
    'No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo.',
  );
}

export const mensajeAlEliminarCategoria = (e: unknown) =>
  mensajeAlCambiar(e, 'No pudimos eliminar la categoría. Inténtalo de nuevo en unos minutos.');

export const fallosDeCategorias = (e: unknown) => ({
  mensaje: mensajeDeFallo(
    e,
    'No pudimos cargar tus categorías. Inténtalo de nuevo en unos minutos.',
  ),
  reintentar: true,
});

export const textoDeMovimientos = (cantidad: number) =>
  `${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'}`;

/**
 * Qué pasa con lo anotado al eliminar: pasa a la categoría "Otros" del mismo tipo. Con 0 no se dice "no tiene
 * movimientos" porque el conteo no incluye las compras con tarjeta.
 */
export function avisoAlEliminarCategoria(tipo: TipoMovimiento, movimientos: number) {
  const destino = `a la categoría "Otros ${tipo === 'INGRESO' ? 'ingresos' : 'egresos'}".`;
  if (movimientos === 0)
    return `Lo que hayas anotado con esta categoría no se borra: pasará ${destino}`;
  if (movimientos === 1) return `Su movimiento no se borra: pasará ${destino}`;
  return `Sus ${movimientos} movimientos no se borran: pasarán ${destino}`;
}
