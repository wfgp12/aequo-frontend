import Registrar from '@/app/registrar';
import {
  obtenerCuotaPrevia,
  type CompraCredito,
  type CuotaPrevia,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AMEX_ID, VISA_ID } from './datos-tarjetas';
import { boton, textosEnOrden } from './tarjetas';

// Ayudas compartidas por las pruebas de la compra con tarjeta y del avance en efectivo
// (criterios/05-compra-con-tarjeta.md). No son pruebas: Jest solo corre los archivos *.test.ts(x).
// Los `jest.mock` no se pueden compartir: cada archivo de prueba simula sus propios adaptadores.

export { AMEX_ID, VISA_ID };

const FECHAS = { creadaEn: '2026-09-17T15:00:00.000Z', actualizadaEn: '2026-09-17T15:00:00.000Z' };

// Ojo: en estos criterios "Amex" tiene la cuota única sin interés y "Visa Bancolombia", no (al revés que en 5.1.3)
export const AMEX_T: Tarjeta = {
  id: AMEX_ID,
  nombre: 'Amex',
  tasaEA: 0.2421,
  cuotaUnicaSinInteres: true,
  ...FECHAS,
};
export const VISA_T: Tarjeta = {
  id: VISA_ID,
  nombre: 'Visa Bancolombia',
  tasaEA: 0.2921,
  cuotaUnicaSinInteres: false,
  ...FECHAS,
};

export const ALIMENTACION = {
  id: 'cat-1',
  nombre: 'Alimentación',
  tipo: 'EGRESO' as const,
  esPredeterminada: true,
  movimientos: 0,
};

export const OPCION = {
  amex: 'Amex, Tasa 24,21 % E.A.',
  visa: 'Visa Bancolombia, Tasa 29,21 % E.A.',
};

export const TEXTO = {
  cargandoTarjetas: 'Cargando tus tarjetas',
  errorTarjetas: 'No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos.',
  sinTarjetas: 'Todavía no tienes tarjetas. Agrega la primera para continuar.',
  calculando: 'Calculando tu cuota',
  errorCuota: 'No pudimos calcular tu cuota. Inténtalo de nuevo.',
  rangoCuotas: 'Las cuotas van de 1 a 60.',
  nota: 'Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar.',
  pagoUnico: '1 cuota: pago único, sin interés.',
  tarjetaYaNoExiste: 'Esta tarjeta ya no existe. Vuelve atrás y elige otra.',
  categoriaYaNoExiste: 'Esta categoría ya no existe. Vuelve atrás y elige otra.',
  errorCompra: 'No pudimos guardar tu compra. Revisa los datos e inténtalo de nuevo.',
  procesandoCompra:
    'Tu compra todavía se está guardando. Espera unos segundos e inténtalo de nuevo.',
  errorAvance: 'No pudimos guardar tu avance. Revisa los datos e inténtalo de nuevo.',
  procesandoAvance:
    'Tu avance todavía se está guardando. Espera unos segundos e inténtalo de nuevo.',
  dineroRecibido: 'Este dinero entra como dinero recibido: no cuenta como ingreso propio.',
};

// Palabras que el usuario nunca debe leer en estos pasos (RNF-04)
export const TECNICO =
  /tasaEA|cuotaUnicaSinInteres|tarjetaId|primerPago|mesUltimoPago|idempoten|payload|amortiz|ApiError|NetworkError|internal server|TARJETA_CREDITO|DINERO_RECIBIDO|(?<![\d.,])(?:400|404|409|422|500)(?![\d.,])/i;

/** El tipo `AVANCE` del backend, en mayúsculas (la palabra "avance" sí se puede leer). */
export const TIPO_AVANCE = /AVANCE/;

// --- Relojes simulados: hoy es el 19 de noviembre de 2026 y la espera de 400 ms de la cuota se controla a mano ---

export const HOY = new Date(2026, 10, 19, 12);
const NO_FALSEAR = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
] as const;

/** Congela la fecha y deja que la prueba adelante `setTimeout` (la espera de 400 ms) a su ritmo. */
export const usarReloj = () => jest.useFakeTimers({ now: HOY, doNotFake: [...NO_FALSEAR] });
export const dejarReloj = () => jest.useRealTimers();

/** Adelanta el reloj simulado y deja que se resuelvan las promesas pendientes. */
export const esperar = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
export const vaciar = () => act(async () => {});

// --- Lo que se ve ---

/** Todo el texto de la pantalla en una línea: sirve para comprobar "etiqueta valor" sin importar cómo se parta en filas. */
export const plano = () => textosEnOrden().join(' ').replace(/\s+/g, ' ');

export const hayCalculando = () =>
  screen.queryByLabelText(TEXTO.calculando) !== null ||
  screen.queryByText(TEXTO.calculando) !== null;
export const hayEstimacion = () => screen.queryByText(/Cuota estimada/) !== null;
export const haySiguiente = () => screen.queryByRole('button', { name: 'Siguiente' }) !== null;
export const siguiente = () => boton('Siguiente');
export const campoCuotas = () => screen.getByLabelText('Número de cuotas');

/** El teclado del campo es numérico, sea con `keyboardType` o con `inputMode`. */
export const esNumerico = (campo: { props: Record<string, unknown> }) =>
  [campo.props.keyboardType, campo.props.inputMode].some(
    (v) => v === 'number-pad' || v === 'numeric',
  );

// --- Recorridos (la pantalla ya está dibujada con sus adaptadores simulados) ---

export async function escribirValor(valor: string) {
  await fireEvent.changeText(await screen.findByLabelText('Monto en pesos'), valor);
  await fireEvent.press(screen.getByText('Siguiente'));
}

/** Registro de un egreso: valor y categoría "Alimentación", hasta "¿Cómo pagaste?". */
export async function hastaMetodo(valor = '1254700') {
  await escribirValor(valor);
  await fireEvent.press(await screen.findByLabelText('Alimentación'));
  await screen.findByText('¿Cómo pagaste?');
}

/** Toca "Tarjeta crédito" y espera la lista de tarjetas (con o sin tarjetas, se ve "+ Agregar tarjeta"). */
export async function hastaTarjetas(valor?: string) {
  await hastaMetodo(valor);
  await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
}

/** Elige la tarjeta y deja que llegue la primera estimación (la de 1 cuota, que se pide al llegar). */
export async function elegirTarjeta(opcion: string) {
  await fireEvent.press(boton(opcion));
  await screen.findByText('¿Cuántas cuotas?');
  await vaciar();
}

export async function hastaCuotas(opcion = OPCION.visa, valor?: string) {
  await hastaTarjetas(valor);
  await elegirTarjeta(opcion);
}

/** Toca una de las opciones fijas (3, 6 o 12) y espera los 400 ms y la respuesta. */
export async function elegirCuotas(cuotas: number) {
  await fireEvent.press(boton(`${cuotas} cuotas`));
  await esperar(400);
}

export async function mesSiguiente(veces = 1) {
  for (let i = 0; i < veces; i++) await fireEvent.press(boton('Mes siguiente'));
}
export async function mesAnterior(veces = 1) {
  for (let i = 0; i < veces; i++) await fireEvent.press(boton('Mes anterior'));
}

/** Desde las cuotas, con la estimación a la vista: "Siguiente" hasta la fecha. */
export async function hastaFecha() {
  await fireEvent.press(siguiente());
  await screen.findByText('¿Cuándo fue?');
}

/** De la fecha a la nota y el resumen. */
export async function hastaResumen() {
  await fireEvent.press(screen.getByText('Siguiente'));
  await screen.findByText('¿Quieres agregar una nota?');
}

/** Un `Pressable` con el texto "Atrás" (en estos pasos es un botón con ese nombre). */
export const atras = () => boton('Atrás');

/** Lo que responde GET /tarjetas/:id/cuota (la cuota viene sin redondear). */
export const cuotaDe = (
  cuota: number,
  mesUltimoPago = '2027-11',
  parcial: Partial<CuotaPrevia> = {},
): CuotaPrevia => ({
  cuota,
  mesUltimoPago,
  tasaEAAplicada: 0.2921,
  cuotaUnicaSinInteres: false,
  ...parcial,
});

/** Lo que responde POST /tarjetas/:id/compras (y /avances, con `tipo: 'AVANCE'`). */
export const compraDe = (parcial: Partial<CompraCredito> = {}): CompraCredito => ({
  id: '66b0b3c4d5e6f70012ab34cd',
  tarjetaId: VISA_ID,
  categoriaId: 'cat-1',
  tipo: 'COMPRA',
  descripcion: 'Alimentación',
  valor: 1254700,
  cuotas: 12,
  fecha: '2026-11-19',
  primerPago: '2026-12',
  mesUltimoPago: '2027-11',
  tasaEAAplicada: 0.2921,
  cuotaUnicaSinInteres: false,
  cuota: 119802.1331718775,
  creadaEn: '2026-11-19T17:00:00.000Z',
  actualizadaEn: '2026-11-19T17:00:00.000Z',
  ...parcial,
});

export type OpcionesDeRecorrido = {
  tarjeta?: string;
  valor?: string;
  /** Cuotas fijas (3, 6 o 12); 1 es la que viene elegida. */
  cuotas?: 1 | 3 | 6 | 12;
  /** Cuántas veces toca "Mes siguiente" (el primer pago parte de noviembre 2026). */
  meses?: number;
  /** Lo que responde la vista previa de la cuota (el adaptador debe estar simulado). */
  respuesta?: CuotaPrevia;
  /** Toca "Ayer" en la fecha. */
  ayer?: boolean;
};

const POR_DEFECTO: Required<OpcionesDeRecorrido> = {
  tarjeta: OPCION.visa,
  valor: '1254700',
  cuotas: 12,
  meses: 1,
  respuesta: cuotaDe(119802.1331718775, '2027-11'),
  ayer: false,
};

/** Registra un egreso con tarjeta hasta quedar en el resumen (por defecto: $ 1.254.700, Visa, 12 cuotas desde diciembre 2026). */
export async function llegarAlResumen(opciones: OpcionesDeRecorrido = {}) {
  const { tarjeta, valor, cuotas, meses, respuesta, ayer } = { ...POR_DEFECTO, ...opciones };
  jest.mocked(obtenerCuotaPrevia).mockReset().mockResolvedValue(respuesta);
  const pantalla = await render(<Registrar />);
  await hastaCuotas(tarjeta, valor);
  if (cuotas !== 1) await elegirCuotas(cuotas);
  if (meses) {
    await mesSiguiente(meses);
    await esperar(400);
  }
  await hastaFecha();
  if (ayer) await fireEvent.press(screen.getByRole('button', { name: 'Ayer' }));
  await hastaResumen();
  return pantalla;
}
