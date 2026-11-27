import { ApiError } from '@/lib/api/client';
import type { CuotaDelMes, ProyeccionTarjeta } from '@/lib/api/tarjetas';
import { formatearPesos } from '@/lib/dinero';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  ANTES_DEL_PRIMER_PAGO,
  CON_CUOTAS,
  dejarHoy,
  dibujarDetalle,
  fijarHoy,
  hayBoton,
  hayCargando,
  mostrarDetalle,
  pagosPedidos,
  proyeccionPedida,
  servirDetalle,
  SOLO_CARGOS,
  tarjetaPedida,
  TEXTO,
  VACIA,
} from './ayudas/detalle-tarjeta';
import {
  abrirHoja,
  escribirValor,
  guardarYVerConfirmacion,
  pagoRegistradoDe,
  registrarPagoSimulado,
} from './ayudas/pago-tarjeta';
import { reiniciarRouter, router, volverAlFoco } from './ayudas/router-simulado';
import { boton, pendiente, textosEnOrden } from './ayudas/tarjetas';

// Las cuotas por compra en el detalle de la tarjeta (criterios/05-cuotas-pendientes.md). Salen del `detalle` de la
// proyección que la pantalla ya pide. El backend se simula en el borde del adaptador. Hoy es el 19 de noviembre de
// 2026.
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  obtenerTarjeta: jest.fn(),
  obtenerProyeccion: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
  listarPagos: jest.fn(),
  registrarPago: jest.fn(),
  eliminarPago: jest.fn(),
}));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  registrarPagoSimulado().mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const cuota = (
  compraId: string,
  descripcion: string,
  numeroCuota: number,
  totalCuotas: number,
  valor: number,
  tipo: CuotaDelMes['tipo'] = 'COMPRA',
): CuotaDelMes => ({ compraId, descripcion, tipo, numeroCuota, totalCuotas, cuota: valor });

const CUATRO = [
  cuota('c-1', 'Mercado', 2, 6, 45000),
  cuota('c-2', 'Tenis', 1, 3, 83478.247168),
  cuota('c-3', 'Gasolina', 1, 1, 80000),
  cuota('c-4', 'Avance en efectivo', 3, 12, 119802.133172, 'AVANCE'),
];

const FRASES = [
  'Mercado, cuota 2 de 6, $ 45.000',
  'Tenis, cuota 1 de 3, $ 83.478',
  'Gasolina, pago único, $ 80.000',
  'Avance en efectivo, cuota 3 de 12, $ 119.802',
];

/** Las cuatro filas como se leen en pantalla: título y valor, sin nada entre una y otra. */
const FILAS_VISIBLES =
  'Mercado · cuota 2/6$ 45.000' +
  'Tenis · cuota 1/3$ 83.478' +
  'Gasolina · pago único$ 80.000' +
  'Avance en efectivo · cuota 3/12$ 119.802';

const TITULO = 'Cuotas de este mes';

/** La respuesta de CON_CUOTAS (u otra) con ese `detalle`, para el mes que se pida. */
const con =
  (detalle: CuotaDelMes[], resto: Partial<ProyeccionTarjeta> = {}) =>
  (mes: string): ProyeccionTarjeta => ({ ...CON_CUOTAS, ...resto, mes, detalle });

/** Todo el texto seguido, sin separadores: no importa en cuántos trozos se escriba cada línea. */
const corrido = () => textosEnOrden().join('');
/** Las filas de las cuotas, como las anuncia un lector de pantalla. */
const filas = () =>
  screen
    .queryAllByLabelText(/, (cuota \d+ de \d+|pago único), \$ /)
    .map((fila) => fila.props.accessibilityLabel as string);
const haySeccion = () => screen.queryByText(/^Cuotas de /) !== null;

describe('Las cuotas del mes, compra por compra', () => {
  it('CA-RF30-F38 ve "Cuotas de este mes" y una fila por compra con su título y su valor, entre lo que queda por pagar y "Próximos meses"', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    for (const texto of [
      'Mercado · cuota 2/6',
      '$ 45.000',
      'Tenis · cuota 1/3',
      '$ 83.478',
      'Gasolina · pago único',
      '$ 80.000',
      'Avance en efectivo · cuota 3/12',
      '$ 119.802',
    ]) {
      expect(screen.getByText(texto)).toBeOnTheScreen();
    }
    // El lugar, el orden y que cada fila no tiene segunda línea
    expect(corrido()).toContain(`${TEXTO.notaDelSaldo}${TITULO}${FILAS_VISIBLES}${TEXTO.proximos}`);
    expect(corrido()).not.toMatch(/vence|cuotas pendientes/i);
    // Lo de antes no cambia de orden
    const posiciones = [TEXTO.esteMes, 'Este mes has pagado', TEXTO.porPagarEsteMes, TITULO].map(
      (parte) => corrido().indexOf(parte),
    );
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('CA-RF30-F38 sin meses siguientes la sección se ve igual', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO, { saldoPendiente: 0, proyeccion: [] }) });

    expect(corrido()).toContain(`${TEXTO.notaDelSaldo}${TITULO}${FILAS_VISIBLES}`);
    expect(screen.queryByText(TEXTO.proximos)).toBeNull();
  });

  it('CA-RF30-F39 una compra a una sola cuota dice "pago único" y un avance se ve como una fila más', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });

    expect(screen.getByText('Gasolina · pago único')).toBeOnTheScreen();
    expect(screen.getByText('Avance en efectivo · cuota 3/12')).toBeOnTheScreen();
    expect(corrido()).not.toMatch(/cuota 1\/1/);
    expect(corrido()).not.toMatch(/AVANCE|COMPRA/);
  });

  it('CA-RF30-F39 un avance con descripción propia se ve con ella, sin etiquetas añadidas', async () => {
    await mostrarDetalle({
      proyeccion: con([cuota('a-1', 'Para el arriendo', 1, 1, 500000, 'AVANCE')]),
    });

    expect(corrido()).toContain(`${TITULO}Para el arriendo · pago único$ 500.000${TEXTO.proximos}`);
    expect(corrido()).not.toMatch(/avance/i);
  });

  it('CA-RF30-F40 se ven las 30 filas en el orden del backend, las repetidas por separado y sin paginar', async () => {
    const treinta = Array.from({ length: 30 }, (_, i) =>
      // Nombres y valores salteados a propósito: ni alfabético ni de mayor a menor
      cuota(`c-${i}`, `Compra ${(i * 7) % 30}`, 1, 3, 1000 + ((i * 11) % 30)),
    );
    treinta[4] = cuota('repetida-1', 'Mercado', 2, 6, 45000);
    treinta[20] = cuota('repetida-2', 'Mercado', 2, 6, 45000);

    await mostrarDetalle({ proyeccion: con(treinta) });

    const esperadas = treinta.map(
      (c) =>
        `${c.descripcion}, cuota ${c.numeroCuota} de ${c.totalCuotas}, $ ${formatearPesos(c.cuota)}`,
    );
    expect(filas()).toEqual(esperadas);
    expect(screen.getAllByText('Mercado · cuota 2/6')).toHaveLength(2);
    expect(screen.queryByText(/ver más|cargar más|página/i)).toBeNull();
  });

  it('CA-RF30-F41 una descripción de 200 caracteres se ve completa, con su número de cuota y su valor', async () => {
    const larga = 'Compra de cosas para la casa '.repeat(7).slice(0, 199) + 'Z';
    expect(larga).toHaveLength(200);

    await mostrarDetalle({ proyeccion: con([cuota('c-1', larga, 2, 6, 45000)]) });

    const titulo = screen.getByText(`${larga} · cuota 2/6`);
    expect(titulo).toBeOnTheScreen();
    // Sin recorte: el texto no se limita a un número de líneas
    expect(titulo.props.numberOfLines).toBeUndefined();
    expect(screen.getByText('$ 45.000')).toBeOnTheScreen();
    expect(corrido()).not.toMatch(/…|\.\.\./);
  });

  it('CA-RF30-F42 cada valor se redondea al peso y la pantalla no suma ni corrige la diferencia', async () => {
    await mostrarDetalle({
      proyeccion: con(
        [cuota('c-1', 'Mercado', 2, 6, 100000.4), cuota('c-2', 'Tenis', 1, 3, 100000.4)],
        {
          cuotas: 200000.8,
          cargosFijos: 0,
          total: 200000.8,
          saldoPendiente: 0,
          proyeccion: [],
          diferencia: -200000.8,
        },
      ),
    });

    expect(filas()).toEqual(['Mercado, cuota 2 de 6, $ 100.000', 'Tenis, cuota 1 de 3, $ 100.000']);
    expect(screen.getByText('Cuotas $ 200.001')).toBeOnTheScreen();
    expect(corrido()).toContain(`${TITULO}Mercado · cuota 2/6$ 100.000Tenis · cuota 1/3$ 100.000`);
    expect(corrido()).not.toContain('$ 200.000');
    expect(corrido()).not.toMatch(/\$ [\d.]*,|NaN|ajuste/i);
  });

  it.each([
    ['con solo cargos fijos', SOLO_CARGOS],
    ['antes del primer pago', ANTES_DEL_PRIMER_PAGO],
    ['con la tarjeta sin nada', VACIA],
  ])(
    'CA-RF30-F43 %s no hay sección, ni filas, ni un aviso de "sin cuotas"',
    async (_caso, base) => {
      await mostrarDetalle({ proyeccion: (mes) => ({ ...base, mes, detalle: [] }) });

      expect(haySeccion()).toBe(false);
      expect(filas()).toEqual([]);
      expect(screen.queryByText(/sin cuotas|no (tienes|hay) cuotas/i)).toBeNull();
    },
  );

  it('CA-RF30-F43 los cargos fijos nunca son filas: siguen sumados en la línea "Cargos fijos"', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });

    expect(filas()).toEqual(FRASES);
    expect(screen.getByText('Cargos fijos $ 55.000')).toBeOnTheScreen();
  });
});

describe('Las cuotas del mes frente a los pagos y las recargas', () => {
  it('CA-RF30-F44 registrar un pago por todo lo estimado no marca ni quita filas', async () => {
    let pagado = false;
    registrarPagoSimulado().mockImplementation(async () => {
      pagado = true;
      return pagoRegistradoDe({ valor: 346270 }, { pagado: 346270.05016469, diferencia: 0 });
    });
    await mostrarDetalle({
      proyeccion: (mes) =>
        con(CUATRO, pagado ? { pagado: CON_CUOTAS.total, diferencia: 0 } : {})(mes),
    });
    expect(filas()).toEqual(FRASES);

    await abrirHoja();
    await escribirValor('346270');
    await guardarYVerConfirmacion();
    await fireEvent.press(boton('Listo'));

    expect(await screen.findByText('Pagaste justo lo estimado')).toBeOnTheScreen();
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(filas()).toEqual(FRASES);
    expect(corrido()).toContain(`${TITULO}${FILAS_VISIBLES}${TEXTO.proximos}`);
    expect(corrido()).not.toMatch(/\bpagada\b|pendiente|✓|✔/i);
  });

  it('CA-RF30-F44 si al volver a la pantalla llega otro detalle, las filas son las nuevas', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });
    expect(filas()).toEqual(FRASES);
    proyeccionPedida().mockImplementation(async (_id, mes) =>
      con([cuota('c-9', 'Nevera', 1, 12, 150000)])(mes),
    );

    await volverAlFoco();

    expect(await screen.findByText('Nevera · cuota 1/12')).toBeOnTheScreen();
    expect(filas()).toEqual(['Nevera, cuota 1 de 12, $ 150.000']);
  });

  it('CA-RF30-F45 con error y mientras carga no hay sección; al reintentar aparece, sin consultas nuevas', async () => {
    const fetchOriginal = globalThis.fetch;
    const red = jest.fn();
    globalThis.fetch = red as unknown as typeof fetch;
    const segunda = pendiente<ProyeccionTarjeta>();
    proyeccionPedida()
      .mockRejectedValueOnce(new ApiError(500, 'x'))
      .mockReturnValueOnce(segunda.promesa);

    await dibujarDetalle();
    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(haySeccion()).toBe(false);
    expect(filas()).toEqual([]);

    await fireEvent.press(boton('Reintentar'));
    expect(hayCargando()).toBe(true);
    expect(haySeccion()).toBe(false);
    expect(filas()).toEqual([]);

    await act(async () => segunda.resolver(con(CUATRO)('2026-11')));

    await waitFor(() => expect(filas()).toEqual(FRASES));
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(red).not.toHaveBeenCalled();
    globalThis.fetch = fetchOriginal;
  });

  it('CA-RF30-F46 cada fila se anuncia como una sola frase', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(filas()).toEqual(FRASES);
    for (const frase of FRASES) {
      expect(screen.getByLabelText(frase)).toHaveProp('accessible', true);
    }
  });

  it('CA-RF30-F46 las filas no son botones: tocarlas no hace nada', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });
    const fila = screen.getByText('Mercado · cuota 2/6');

    await fireEvent.press(fila);
    await act(async () => {});

    expect(hayBoton(FRASES[0])).toBe(false);
    expect(screen.queryByRole('button', { name: /Mercado/ })).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText('Nuevo pago')).toBeNull();
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(registrarPagoSimulado()).not.toHaveBeenCalled();
  });

  it('CA-RF30-F47 si la respuesta no trae `detalle`, el detalle se ve como antes, sin la sección ni avisos', async () => {
    await mostrarDetalle({
      proyeccion: (mes) => {
        const sinDetalle: Record<string, unknown> = { ...CON_CUOTAS, mes };
        delete sinDetalle.detalle;
        return sinDetalle as unknown as ProyeccionTarjeta;
      },
    });

    expect(screen.getByLabelText('Este mes pagas, $ 346.270')).toBeOnTheScreen();
    expect(screen.getByLabelText('Este mes has pagado, $ 0')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.porPagarEsteMes)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.proximos)).toBeOnTheScreen();
    expect(haySeccion()).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Las cuotas de otros meses', () => {
  const MERCADO_3 = [cuota('c-1', 'Mercado', 3, 6, 45000)];

  it('CA-RF31-F10 al pasar de mes no quedan filas del anterior y la sección es la del mes nuevo', async () => {
    await mostrarDetalle({ proyeccion: con(CUATRO) });
    expect(filas()).toEqual(FRASES);
    const diciembre = pendiente<ProyeccionTarjeta>();
    proyeccionPedida().mockReturnValueOnce(diciembre.promesa);

    await fireEvent.press(boton('Mes siguiente'));

    expect(hayCargando()).toBe(true);
    expect(filas()).toEqual([]);
    expect(haySeccion()).toBe(false);

    await act(async () => diciembre.resolver(con(MERCADO_3)('2026-12')));

    expect(await screen.findByText('Cuotas de diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('Mercado · cuota 3/6')).toBeOnTheScreen();
    expect(filas()).toEqual(['Mercado, cuota 3 de 6, $ 45.000']);
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('CA-RF31-F10 en un mes pasado el encabezado nombra el mes', async () => {
    await mostrarDetalle({
      proyeccion: (mes) => con(mes === '2026-10' ? MERCADO_3 : CUATRO)(mes),
    });

    await fireEvent.press(boton('Mes anterior'));

    expect(await screen.findByText('Cuotas de octubre 2026')).toBeOnTheScreen();
    expect(screen.queryByText(TITULO)).toBeNull();
  });
});
