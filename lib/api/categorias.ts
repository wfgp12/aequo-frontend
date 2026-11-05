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

/**
 * POST /categorias: crea una categoría personal (nombre de 1 a 40 letras; un 409 si ya existe una con ese nombre).
 * La clave (UUID) identifica la acción del usuario: un reintento la reutiliza y el backend no crea una segunda categoría.
 */
export function crearCategoria(
  datos: { nombre: string; tipo: TipoMovimiento },
  claveIdempotencia: string,
) {
  return requestAutenticado<Categoria>('/categorias', {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** GET /categorias: las generales y las del usuario, con las generales primero y luego por nombre. */
export async function listarCategorias(tipo?: TipoMovimiento) {
  const consulta = tipo ? `?tipo=${tipo}` : '';
  const { items } = await requestAutenticado<{ items: Categoria[] }>(`/categorias${consulta}`);
  return items;
}
