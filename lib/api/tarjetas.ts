import { requestAutenticado } from './autenticado';

export type Tarjeta = {
  id: string;
  /** Alias de la tarjeta (único por usuario, máximo 50 caracteres). */
  nombre: string;
  /** Fracción de 0 a 1 (29,21 % es 0.2921). La conversión al porcentaje que ve el usuario está en `lib/tasa`. */
  tasaEA: number;
  cuotaUnicaSinInteres: boolean;
  creadaEn: string;
  actualizadaEn: string;
};

export type CargoFijo = {
  id: string;
  tarjetaId: string;
  /** Máximo 100 caracteres. */
  descripcion: string;
  /** Pesos al mes, mayor que 0. */
  valor: number;
  activo: boolean;
  creadaEn: string;
  actualizadaEn: string;
};

export type DatosTarjeta = Pick<Tarjeta, 'nombre' | 'tasaEA' | 'cuotaUnicaSinInteres'>;
export type DatosCargo = Pick<CargoFijo, 'descripcion' | 'valor' | 'activo'>;

const rutaCargos = (tarjetaId: string) => `/tarjetas/${tarjetaId}/cargos`;

/** GET /tarjetas: ya vienen ordenadas por nombre y sin paginación. */
export async function listarTarjetas(): Promise<Tarjeta[]> {
  const { items } = await requestAutenticado<{ items: Tarjeta[] }>('/tarjetas');
  return items;
}

/** POST /tarjetas: la clave (UUID) identifica la acción del usuario; un reintento la reutiliza. */
export function crearTarjeta(datos: DatosTarjeta, claveIdempotencia: string) {
  return requestAutenticado<Tarjeta>('/tarjetas', {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** PATCH /tarjetas/:id: solo los campos que cambian; aquí también se cambia la tasa. Sin clave. */
export function actualizarTarjeta(id: string, cambios: Partial<DatosTarjeta>) {
  return requestAutenticado<Tarjeta>(`/tarjetas/${id}`, { method: 'PATCH', body: cambios });
}

/** DELETE /tarjetas/:id: responde 204 sin cuerpo y borra también sus cargos fijos (409 si ya tiene pagos). */
export async function eliminarTarjeta(id: string) {
  await requestAutenticado<null>(`/tarjetas/${id}`, { method: 'DELETE' });
}

/** GET /tarjetas/:tarjetaId/cargos: todos (activos e inactivos), por fecha de creación. */
export async function listarCargos(tarjetaId: string): Promise<CargoFijo[]> {
  const { items } = await requestAutenticado<{ items: CargoFijo[] }>(rutaCargos(tarjetaId));
  return items;
}

/** POST /tarjetas/:tarjetaId/cargos, con clave de idempotencia. */
export function crearCargo(tarjetaId: string, datos: DatosCargo, claveIdempotencia: string) {
  return requestAutenticado<CargoFijo>(rutaCargos(tarjetaId), {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** PATCH …/cargos/:id: solo los campos que cambian; activar y desactivar es cambiar `activo`. Sin clave. */
export function actualizarCargo(tarjetaId: string, id: string, cambios: Partial<DatosCargo>) {
  return requestAutenticado<CargoFijo>(`${rutaCargos(tarjetaId)}/${id}`, {
    method: 'PATCH',
    body: cambios,
  });
}

/** DELETE …/cargos/:id: responde 204 sin cuerpo. */
export async function eliminarCargo(tarjetaId: string, id: string) {
  await requestAutenticado<null>(`${rutaCargos(tarjetaId)}/${id}`, { method: 'DELETE' });
}
