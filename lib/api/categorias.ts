import { requestAutenticado } from './autenticado';

export type TipoMovimiento = 'INGRESO' | 'EGRESO';

export type Categoria = {
  id: string;
  nombre: string;
  tipo: TipoMovimiento;
  /** true = categoría general de Aequo (no se edita ni se elimina); false = del usuario. */
  esPredeterminada: boolean;
  /** Cantidad de movimientos del usuario con esta categoría. */
  movimientos: number;
};

/** GET /categorias: las generales y las del usuario, con las generales primero y luego por nombre. */
export async function listarCategorias(tipo?: TipoMovimiento) {
  const consulta = tipo ? `?tipo=${tipo}` : '';
  const { items } = await requestAutenticado<{ items: Categoria[] }>(`/categorias${consulta}`);
  return items;
}
