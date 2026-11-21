import { ApiError } from '@/lib/api/client';
import {
  obtenerProyeccion,
  obtenerTarjeta,
  type MesProyectado,
  type ProyeccionTarjeta,
} from '@/lib/api/tarjetas';
import { render, screen, waitFor } from '@testing-library/react-native';
import { VISA, VISA_ID, type crearServidorDeTarjetas } from './datos-tarjetas';
import { usarParametros } from './router-simulado';
import { boton, textosEnOrden } from './tarjetas';

// Ayudas compartidas por las pruebas del detalle de la tarjeta (criterios/05-detalle-de-tarjeta.md). No son
// pruebas: Jest solo corre los archivos *.test.ts(x). Los `jest.mock` no se pueden compartir: cada archivo de
// prueba simula `expo-router` (ver ./router-simulado) y `@/lib/api/tarjetas` con, al menos, `listarTarjetas`,
// `obtenerTarjeta`, `obtenerProyeccion`, `crearTarjeta`, `actualizarTarjeta` y `eliminarTarjeta`.

export { VISA, VISA_ID };

// --- Hoy es el 19 de noviembre de 2026 (reloj simulado: solo la fecha; los temporizadores siguen siendo reales) ---

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
  'setTimeout',
  'clearTimeout',
] as const;
export const fijarHoy = () => jest.useFakeTimers({ now: HOY, doNotFake: [...NO_FALSEAR] });
export const dejarHoy = () => jest.useRealTimers();

// --- Lo que responde el backend (cifras del escenario base, recortadas; la pantalla no verifica que cuadren) ---

export function mes(
  periodo: string,
  cuotas: number,
  cargosFijos: number,
  total: number,
  saldoPendiente = 0,
): MesProyectado {
  return { mes: periodo, cuotas, cargosFijos, total, saldoPendiente };
}

export function proyeccionDe(
  periodo: string,
  resto: Partial<ProyeccionTarjeta> = {},
): ProyeccionTarjeta {
  return {
    tarjetaId: VISA_ID,
    mes: periodo,
    cuotas: 0,
    cargosFijos: 0,
    total: 0,
    saldoPendiente: 0,
    proyeccion: [],
    ...resto,
  };
}

export const CON_CUOTAS = proyeccionDe('2026-11', {
  cuotas: 291270.05016469,
  cargosFijos: 55000,
  total: 346270.05016469,
  saldoPendiente: 1766528.890201,
  proyeccion: [
    mes('2026-12', 209543.21823395, 55000, 264543.21823395, 239604.26634376),
    mes('2027-01', 119802.13317188, 55000, 174802.13317188, 119802.13317188),
    mes('2027-02', 119802.13317188, 55000, 174802.13317188, 0),
  ],
});
export const ANTES_DEL_PRIMER_PAGO = proyeccionDe('2026-11', {
  saldoPendiente: 1437625.598063,
  proyeccion: [
    mes('2026-12', 119802.133172, 0, 119802.133172, 119802.133172),
    mes('2027-01', 119802.133172, 0, 119802.133172, 0),
  ],
});
export const SOLO_CARGOS = proyeccionDe('2026-11', { cargosFijos: 55000, total: 55000 });
export const VACIA = proyeccionDe('2026-11');

// --- Textos de la pantalla ---

export const TEXTO = {
  cargando: 'Cargando tu tarjeta',
  errorCarga: 'No pudimos cargar tu tarjeta. Inténtalo de nuevo en unos minutos.',
  yaNoExiste: 'Esta tarjeta ya no existe.',
  vacia:
    'No tienes pagos pendientes con esta tarjeta. Cuando registres compras a cuotas o cargos fijos, los verás aquí.',
  notaDelTotal: 'Estimado con la tasa de tu tarjeta. El valor real de tu extracto puede variar.',
  notaDelSaldo: 'Suma las cuotas que faltan, con sus intereses. No incluye los cargos fijos.',
  esteMes: 'Este mes pagas',
  porPagarEsteMes: 'Te queda por pagar después de este mes',
  proximos: 'Próximos meses',
};

// Lo que el usuario nunca debe leer (CA-RF30-F32)
export const TECNICO_DEL_DETALLE =
  /saldoPendiente|saldo pendiente|proyecci[oó]n|cargosFijos|tarjetaId|mes de referencia|\bnull\b|undefined|NaN|Infinity|\b(400|404|500)\b/i;

/** Lo que la API no da y la pantalla no debe mostrar (CA-RF30-F33). */
export const SIN_DATOS_DE_LA_API =
  /cupo disponible|deuda total|próximo pago estimado|vence|cuotas pendientes|marcar como pagada|\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;

// --- El servidor simulado ---

type Servidor = ReturnType<typeof crearServidorDeTarjetas>;
export type Opciones = {
  /** Si se da, la tarjeta sale de él (y deja de existir si se elimina). */
  servidor?: Servidor;
  /** Lo que responde la proyección para cada mes (por defecto, CON_CUOTAS con el mes pedido). */
  proyeccion?: (periodo: string) => ProyeccionTarjeta | Promise<ProyeccionTarjeta>;
};

/** Deja a `obtenerTarjeta` y `obtenerProyeccion` respondiendo bien (cada prueba cambia lo que necesite). */
export function servirDetalle({ servidor, proyeccion }: Opciones = {}) {
  const respuesta = proyeccion ?? ((periodo: string) => ({ ...CON_CUOTAS, mes: periodo }));
  jest
    .mocked(obtenerTarjeta)
    .mockReset()
    .mockImplementation(async (id) => (servidor ? servidor.obtener(id) : { ...VISA }));
  jest
    .mocked(obtenerProyeccion)
    .mockReset()
    .mockImplementation(async (id, periodo) => {
      if (servidor && !servidor.items.some((t) => t.id === id)) {
        throw new ApiError(404, 'Tarjeta no encontrada');
      }
      return respuesta(periodo);
    });
}

export const tarjetaPedida = () => jest.mocked(obtenerTarjeta);
export const proyeccionPedida = () => jest.mocked(obtenerProyeccion);
/** Los meses que se pidieron a la proyección, en orden. */
export const mesesPedidos = () => proyeccionPedida().mock.calls.map(([, periodo]) => periodo);

// --- La pantalla ---

/** El detalle se importa al usarlo: si todavía no existe, falla cada prueba que lo necesita y no todo el archivo. */
export function PantallaDeDetalle() {
  const Pantalla = require('@/app/tarjetas/[id]').default;
  return <Pantalla />;
}

export const paramsDeVisa = { id: VISA_ID, nombre: 'Visa Bancolombia' };

/** Dibuja el detalle (por defecto el de "Visa Bancolombia") sin esperar a nadie. */
export async function dibujarDetalle(params: Record<string, string | undefined> = paramsDeVisa) {
  usarParametros(params);
  await render(<PantallaDeDetalle />);
}

/** Dibuja el detalle y espera a que lleguen la tarjeta y los pagos del mes. */
export async function mostrarDetalle(
  opciones: Opciones & { params?: Record<string, string | undefined> } = {},
) {
  servirDetalle(opciones);
  await dibujarDetalle(opciones.params);
  await esperarCarga();
}

export async function esperarCarga() {
  await screen.findByRole('button', { name: 'Editar tarjeta' });
  await waitFor(() => expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull());
}

export const anterior = () => boton('Mes anterior');
export const siguiente = () => boton('Mes siguiente');
export const hayBoton = (nombre: string) => screen.queryByRole('button', { name: nombre }) !== null;
export const hayCargando = () => screen.queryByLabelText(TEXTO.cargando) !== null;
export const hayTexto = (texto: string | RegExp) => screen.queryByText(texto) !== null;
/** Todo el texto de la pantalla en una línea. */
export const plano = () => textosEnOrden().join(' | ');
/** Las filas de "Próximos meses", como las anuncia un lector de pantalla ("diciembre 2026, total $ 264.543"). */
export const filasDeMeses = () =>
  screen
    .queryAllByLabelText(/^[a-záéíóú]+ \d{4}, total \$ /)
    .map((fila) => fila.props.accessibilityLabel as string);
