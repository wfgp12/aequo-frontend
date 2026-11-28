import {
  eliminarPrestamo,
  listarDeudas,
  registrarPrestamo,
  type DeudaConPrestamos,
  type Prestamo,
  type PrestamoRegistrado,
} from '@/lib/api/deudas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, usarParametros } from './router-simulado';
import { boton, textosEnOrden } from './tarjetas';

// Ayudas de las pruebas de préstamos (criterios/06-prestamos.md). No son pruebas: Jest solo corre los archivos
// *.test.ts(x). Cada archivo de prueba simula `expo-router` y `@/lib/api/deudas` (los `jest.mock` no se comparten).
// Las pantallas se piden con `require` dentro de cada ayuda, para que cada archivo dependa solo de la que usa.

export const TEXTO = {
  cargando: 'Cargando tus préstamos',
  cargandoDetalle: 'Cargando el préstamo',
  errorCarga: 'No pudimos cargar tus préstamos. Inténtalo de nuevo en unos minutos.',
  vacio: 'Todavía no tienes préstamos. Registra el primero cuando alguien te preste dinero.',
  nota: 'El dinero que te prestan cuenta como dinero recibido, no como ingreso propio.',
  yaNoExiste: 'Este préstamo ya no existe.',
  dineroRecibido: 'Este dinero entra como dinero recibido: no cuenta como ingreso propio.',
  errorGuardar: 'No pudimos guardar tu préstamo. Revisa los datos e inténtalo de nuevo.',
  enProceso: 'Tu préstamo todavía se está guardando. Espera unos segundos e inténtalo de nuevo.',
  interesDistinto:
    'Ya le debes a esta persona con otro interés. Vuelve atrás y elígela en la lista para conservarlo.',
  simultaneo: 'Se estaba guardando otro préstamo de esta persona. Inténtalo de nuevo.',
  tituloDialogo: '¿Eliminar este préstamo?',
  conAbonos: 'Este préstamo ya tiene abonos y no se puede eliminar.',
  errorEliminar: 'No pudimos eliminar el préstamo. Inténtalo de nuevo en unos minutos.',
};

// --- Hoy es el 28 de noviembre de 2026 ---

const HOY = new Date(2026, 10, 28, 12);
export const fijarHoy = () =>
  jest.useFakeTimers({
    now: HOY,
    doNotFake: [
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
      'setTimeout',
      'clearTimeout',
    ],
  });
export const dejarHoy = () => jest.useRealTimers();

// --- Lo que responde GET /deudas ---

const CREADA = '2026-09-20T15:00:00.000Z';

const prestamo = (id: string, monto: number, fecha: string, descripcion: string): Prestamo => ({
  id,
  monto,
  fecha,
  descripcion,
  creadaEn: CREADA,
});

export const BANCOLOMBIA: DeudaConPrestamos = {
  id: 'deuda-banco',
  acreedor: 'Bancolombia',
  tipoInteres: 'TASA',
  valorInteres: 0.02,
  saldada: false,
  creadaEn: CREADA,
  prestamos: [prestamo('p-banco', 1000000, '2026-10-01', 'Préstamo recibido')],
};

export const PRESTAMO_ARRIENDO = prestamo('p-arriendo', 200000, '2026-09-20', 'Para el arriendo');
export const PRESTAMO_AGOSTO = prestamo('p-agosto', 500000, '2026-08-15', 'Préstamo recibido');

export const PAPA: DeudaConPrestamos = {
  id: 'deuda-papa',
  acreedor: 'Papá',
  tipoInteres: 'SIN_INTERES',
  valorInteres: 0,
  saldada: false,
  creadaEn: CREADA,
  prestamos: [PRESTAMO_ARRIENDO, PRESTAMO_AGOSTO],
};

export const PAPA_PAGADA: DeudaConPrestamos = {
  id: 'deuda-papa-pagada',
  acreedor: 'Papá',
  tipoInteres: 'SIN_INTERES',
  valorInteres: 0,
  saldada: true,
  creadaEn: '2026-01-10T15:00:00.000Z',
  prestamos: [prestamo('p-viejo', 80000, '2026-01-10', 'Mercado')],
};

export const JUAN: DeudaConPrestamos = {
  id: 'deuda-juan',
  acreedor: 'Juan',
  tipoInteres: 'SIN_INTERES',
  valorInteres: 0,
  saldada: false,
  creadaEn: CREADA,
  prestamos: [prestamo('p-juan', 300000, '2026-07-05', 'Préstamo recibido')],
};

/** Lo que responde el 201 de POST /deudas/prestamos. */
export const registrado = (
  acreedor = 'Juan',
  monto = 500000,
  deudaCreada = true,
): PrestamoRegistrado => ({
  deudaCreada,
  deuda: {
    id: 'deuda-nueva',
    acreedor,
    tipoInteres: 'SIN_INTERES',
    valorInteres: 0,
    saldada: false,
    creadaEn: CREADA,
  },
  prestamo: prestamo('p-nuevo', monto, '2026-11-28', 'Préstamo recibido'),
});

export const listar = () => jest.mocked(listarDeudas);
export const registrar = () => jest.mocked(registrarPrestamo);
export const eliminar = () => jest.mocked(eliminarPrestamo);

export const datosEnviados = (n = 0) =>
  // Lo que de verdad viaja: un campo en `undefined` no se envía
  JSON.parse(JSON.stringify(registrar().mock.calls[n][0]));
export const claveEnviada = (n = 0) => registrar().mock.calls[n][1];

// --- Lo que se ve ---

/** Todo el texto de la pantalla en una línea. */
export const plano = () => textosEnOrden().join(' ').replace(/\s+/g, ' ');

/** Cuántas veces la app regresó a "Mis préstamos" (volviendo atrás o yendo a la ruta). */
export const vecesQueVolvio = () =>
  router.back.mock.calls.length +
  [...router.replace.mock.calls, ...router.navigate.mock.calls].filter(
    ([ruta]) => ruta === '/prestamos',
  ).length;

// --- Pantallas ---

export async function montarLista() {
  const MisPrestamos = require('@/app/prestamos').default;
  return render(<MisPrestamos />);
}

export async function montarDetalle(deuda: { id: string; acreedor: string } = PAPA) {
  usarParametros({ id: deuda.id, nombre: deuda.acreedor });
  const Detalle = require('@/app/prestamos/[id]').default;
  return render(<Detalle />);
}

export async function montarRegistro() {
  const RegistrarPrestamo = require('@/app/registrar-prestamo').default;
  return render(<RegistrarPrestamo />);
}

// --- Recorrido del registro ---

export const campoValor = () => screen.getByLabelText('Monto en pesos');
export const siguiente = () => boton('Siguiente');
export const atras = () => boton('Atrás');
export const avanzar = () => fireEvent.press(siguiente());

/** Escribe el valor y llega a "¿Quién te prestó?". */
export async function hastaQuien(valor = '500000') {
  const pantalla = await montarRegistro();
  await fireEvent.changeText(campoValor(), valor);
  await avanzar();
  await screen.findByText('¿Quién te prestó?');
  return pantalla;
}

/** En "¿Quién te prestó?", toca "+ Nuevo prestamista", escribe el nombre y toca "Siguiente". */
export async function nuevoPrestamista(nombre: string) {
  await fireEvent.press(await screen.findByRole('button', { name: '+ Nuevo prestamista' }));
  await fireEvent.changeText(screen.getByLabelText('¿Cómo se llama?'), nombre);
  await avanzar();
}

/** Con una persona nueva, llega a "¿Tiene interés?". */
export async function hastaInteres(nombre = 'Juan', valor?: string) {
  const pantalla = await hastaQuien(valor);
  await nuevoPrestamista(nombre);
  await screen.findByText('¿Tiene interés?');
  return pantalla;
}

/** Toca a una persona de la lista a la que ya se le debe y llega a la fecha. */
export async function elegirPersona(nombre: string) {
  await fireEvent.press(await screen.findByRole('button', { name: nombre }));
  await screen.findByText('¿Cuándo fue?');
}

/** Desde el interés, a la fecha. */
export async function aLaFecha() {
  await avanzar();
  await screen.findByText('¿Cuándo fue?');
}

/** Desde la fecha, a la nota y el resumen. */
export async function aLaNota() {
  await avanzar();
  await screen.findByText('¿Quieres agregar una nota?');
}

/** Persona nueva, sin interés, de hoy: queda en el resumen. */
export async function hastaResumen(nombre = 'Juan', valor?: string) {
  const pantalla = await hastaInteres(nombre, valor);
  await aLaFecha();
  await aLaNota();
  return pantalla;
}

export const guardar = () => fireEvent.press(screen.getByText('Guardar'));

/** Desde el interés ya elegido, termina el recorrido y guarda. */
export async function guardarDesdeInteres() {
  await aLaFecha();
  await aLaNota();
  await guardar();
  await screen.findByText('¡Listo!');
}
