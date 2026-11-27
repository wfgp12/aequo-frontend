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

/** Una compra a cuotas con tarjeta, o un avance en efectivo (`tipo` AVANCE, sin categoría). */
export type CompraCredito = {
  id: string;
  tarjetaId: string;
  categoriaId: string | null;
  tipo: 'COMPRA' | 'AVANCE';
  descripcion: string;
  /** Pesos. */
  valor: number;
  cuotas: number;
  /** YYYY-MM-DD */
  fecha: string;
  /** YYYY-MM */
  primerPago: string;
  /** YYYY-MM, calculado por el backend. */
  mesUltimoPago: string;
  /** Fracción de 0 a 1, la tasa que se aplicó al guardar. */
  tasaEAAplicada: number;
  cuotaUnicaSinInteres: boolean;
  /** Pesos, sin redondear: se redondea al peso solo al mostrarla. */
  cuota: number;
  creadaEn: string;
  actualizadaEn: string;
};

/** Lo que responde GET /tarjetas/:tarjetaId/cuota: la cuota estimada antes de guardar. */
export type CuotaPrevia = Pick<
  CompraCredito,
  'cuota' | 'mesUltimoPago' | 'tasaEAAplicada' | 'cuotaUnicaSinInteres'
>;

/** Lo que se paga en un mes con la tarjeta; todos los montos llegan sin redondear (se redondean al mostrarlos). */
export type MesProyectado = {
  /** YYYY-MM */
  mes: string;
  /** Suma de las cuotas vigentes en el mes (compras y avances). */
  cuotas: number;
  /** Suma de los cargos fijos activos. */
  cargosFijos: number;
  /** Cuotas más cargos fijos: el total estimado a pagar en el mes. */
  total: number;
  /** Cuotas de los meses posteriores, con intereses y sin cargos fijos. */
  saldoPendiente: number;
};

/** La cuota que una compra o un avance pone en el mes consultado. */
export type CuotaDelMes = Pick<CompraCredito, 'descripcion' | 'tipo' | 'cuota'> & {
  compraId: string;
  numeroCuota: number;
  totalCuotas: number;
};

/** Lo que responde GET /tarjetas/:tarjetaId/proyeccion: el mes pedido (`mes`) y los meses que le siguen. */
export type ProyeccionTarjeta = MesProyectado & {
  tarjetaId: string;
  /** Lo que ya se pagó de la tarjeta en `mes` (suma de sus pagos), sin redondear. */
  pagado: number;
  /** `pagado` menos `total`, calculado por el backend: negativa, falta por pagar; positiva, se pagó de más. */
  diferencia: number;
  /** Las cuotas de `mes`, compra por compra, de la más reciente a la más antigua; sin cargos fijos. */
  detalle: CuotaDelMes[];
  /** Los meses siguientes, contiguos, hasta el último con cuotas; vacío si no hay cuotas después de `mes`. */
  proyeccion: MesProyectado[];
};

/** Un pago de la tarjeta: es un egreso sin categoría ligado a ella (no se edita: se elimina y se registra de nuevo). */
export type PagoTarjeta = {
  id: string;
  tarjetaId: string;
  /** Pesos, sin redondear: se redondea al peso solo al mostrarlo. */
  valor: number;
  /** YYYY-MM-DD */
  fecha: string;
  metodoPago: 'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA';
  descripcion: string;
  creadaEn: string;
};

/** Lo pagado frente a lo estimado en el mes de un pago, ya con ese pago incluido; los montos llegan sin redondear. */
export type ComparacionDePagos = {
  /** YYYY-MM */
  mes: string;
  estimado: number;
  pagado: number;
  /** `pagado` menos `estimado`: negativa, falta por pagar; positiva, se pagó de más. */
  diferencia: number;
};

export type PagoRegistrado = PagoTarjeta & { comparacion: ComparacionDePagos };

/** Cuerpo de POST …/pagos: sin fecha, método ni descripción el backend usa hoy, transferencia y "Pago de tarjeta". */
export type DatosPago = Pick<PagoTarjeta, 'valor'> &
  Partial<Pick<PagoTarjeta, 'fecha' | 'metodoPago' | 'descripcion'>>;

export type ConsultaCuota = Pick<CompraCredito, 'valor' | 'cuotas' | 'primerPago'>;

export type DatosTarjeta = Pick<Tarjeta, 'nombre' | 'tasaEA' | 'cuotaUnicaSinInteres'>;
export type DatosCargo = Pick<CargoFijo, 'descripcion' | 'valor' | 'activo'>;
/** Cuerpo de POST …/compras: la descripción es obligatoria (1 a 200 caracteres). */
export type DatosCompra = ConsultaCuota &
  Pick<CompraCredito, 'descripcion'> & { categoriaId: string; fecha?: string };
/** Cuerpo de POST …/avances: sin categoría; la descripción es opcional. */
export type DatosAvance = ConsultaCuota & { fecha?: string; descripcion?: string };

const rutaCargos = (tarjetaId: string) => `/tarjetas/${tarjetaId}/cargos`;

/** GET /tarjetas: ya vienen ordenadas por nombre y sin paginación. */
export async function listarTarjetas(): Promise<Tarjeta[]> {
  const { items } = await requestAutenticado<{ items: Tarjeta[] }>('/tarjetas');
  return items;
}

/** GET /tarjetas/:id: la tarjeta tal como está ahora (404 si ya no existe). */
export function obtenerTarjeta(id: string) {
  return requestAutenticado<Tarjeta>(`/tarjetas/${id}`);
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

/** DELETE /tarjetas/:id: 204 sin cuerpo; borra también sus cargos fijos (409 si ya tiene pagos o compras). */
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

/** POST /tarjetas/:tarjetaId/compras, con clave de idempotencia: la misma clave en cada reintento. */
export function registrarCompra(tarjetaId: string, datos: DatosCompra, claveIdempotencia: string) {
  return requestAutenticado<CompraCredito>(`/tarjetas/${tarjetaId}/compras`, {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** POST /tarjetas/:tarjetaId/avances, con clave de idempotencia. Además crea el dinero recibido en efectivo. */
export function registrarAvance(tarjetaId: string, datos: DatosAvance, claveIdempotencia: string) {
  return requestAutenticado<CompraCredito>(`/tarjetas/${tarjetaId}/avances`, {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** GET /tarjetas/:tarjetaId/cuota: vista previa sin efectos (compras y avances), sin clave de idempotencia. */
export function obtenerCuotaPrevia(tarjetaId: string, consulta: ConsultaCuota) {
  const { valor, cuotas, primerPago } = consulta;
  const parametros = new URLSearchParams({
    valor: String(valor),
    cuotas: String(cuotas),
    primerPago,
  });
  return requestAutenticado<CuotaPrevia>(`/tarjetas/${tarjetaId}/cuota?${parametros}`);
}

/** GET /tarjetas/:tarjetaId/proyeccion?mes=YYYY-MM: lo que se paga ese mes y los siguientes; lectura sin clave. */
export function obtenerProyeccion(tarjetaId: string, mes: string) {
  return requestAutenticado<ProyeccionTarjeta>(`/tarjetas/${tarjetaId}/proyeccion?mes=${mes}`);
}

const rutaPagos = (tarjetaId: string) => `/tarjetas/${tarjetaId}/pagos`;

/** POST /tarjetas/:tarjetaId/pagos, con clave de idempotencia: responde el pago y su comparación con lo estimado. */
export function registrarPago(tarjetaId: string, datos: DatosPago, claveIdempotencia: string) {
  return requestAutenticado<PagoRegistrado>(rutaPagos(tarjetaId), {
    method: 'POST',
    body: datos,
    claveIdempotencia,
  });
}

/** GET /tarjetas/:tarjetaId/pagos[?mes=YYYY-MM]: el más reciente primero; sin `mes`, todos. */
export async function listarPagos(tarjetaId: string, mes?: string): Promise<PagoTarjeta[]> {
  const { items } = await requestAutenticado<{ items: PagoTarjeta[] }>(
    `${rutaPagos(tarjetaId)}${mes ? `?mes=${mes}` : ''}`,
  );
  return items;
}

/** DELETE /tarjetas/:tarjetaId/pagos/:pagoId: responde 204 sin cuerpo. */
export async function eliminarPago(tarjetaId: string, pagoId: string) {
  await requestAutenticado<null>(`${rutaPagos(tarjetaId)}/${pagoId}`, { method: 'DELETE' });
}
