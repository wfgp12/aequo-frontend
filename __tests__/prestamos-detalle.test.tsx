import { ApiError, NetworkError } from '@/lib/api/client';
import type { DeudaConPrestamos } from '@/lib/api/deudas';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  BANCOLOMBIA,
  dejarHoy,
  fijarHoy,
  listar,
  montarDetalle,
  PAPA,
  PAPA_PAGADA,
  plano,
  TEXTO,
} from './ayudas/prestamos';
import { reiniciarRouter, router } from './ayudas/router-simulado';
import { boton, pendiente, RED } from './ayudas/tarjetas';

// El detalle de una deuda (criterios/06-prestamos.md, CA-RF35-F06 y F07 y CA-RF34-F07). No hay GET de una sola
// deuda: se busca en la lista que entrega listarDeudas.
jest.mock('expo-router', () => {
  const simulado = require('./ayudas/router-simulado');
  return {
    ...simulado.expoRouterSimulado(),
    useRouter: () => ({ ...simulado.router, canGoBack: () => true }),
  };
});
jest.mock('@/lib/api/deudas', () => ({
  listarDeudas: jest.fn(),
  registrarPrestamo: jest.fn(),
  eliminarPrestamo: jest.fn(),
}));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  listar().mockReset().mockResolvedValue([BANCOLOMBIA, PAPA, PAPA_PAGADA]);
});
afterEach(() => dejarHoy());

const SECCION = 'LO QUE TE HAN PRESTADO';

async function mostrar(deuda: DeudaConPrestamos = PAPA) {
  await montarDetalle(deuda);
  await screen.findByText(SECCION);
}

function tituloYVolver() {
  expect(screen.getByText('Papá')).toBeOnTheScreen();
  expect(boton('Volver')).toBeOnTheScreen();
}

describe('Detalle: carga y errores', () => {
  it('CA-RF35-F06 mientras carga ve el nombre, "Volver" y el indicador', async () => {
    listar().mockReturnValue(pendiente<DeudaConPrestamos[]>().promesa);

    await montarDetalle();

    tituloYVolver();
    expect(screen.getByLabelText(TEXTO.cargandoDetalle)).toBeOnTheScreen();

    await fireEvent.press(boton('Volver'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['otro fallo', new ApiError(500, 'x'), TEXTO.errorCarga],
  ])('CA-RF35-F06 %s: avisa y "Reintentar" vuelve a consultar', async (_caso, fallo, mensaje) => {
    listar().mockRejectedValueOnce(fallo);
    await montarDetalle();

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();
    tituloYVolver();

    await fireEvent.press(boton('Reintentar'));

    expect(await screen.findByText(SECCION)).toBeOnTheScreen();
    expect(listar()).toHaveBeenCalledTimes(2);
  });

  it('CA-RF35-F06 si la deuda no viene en la lista, dice que ya no existe, sin "Reintentar"', async () => {
    listar().mockResolvedValue([BANCOLOMBIA]);

    await montarDetalle();

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    tituloYVolver();
    expect(screen.queryByText('Reintentar')).toBeNull();
    expect(screen.queryByText('Bancolombia')).toBeNull();
  });
});

describe('Detalle: los montos prestados', () => {
  it('CA-RF35-F07 muestra cada monto con descripción, fecha, valor y botón de eliminar, en el orden del backend', async () => {
    await mostrar();

    tituloYVolver();
    expect(screen.getByText('Sin interés')).toBeOnTheScreen();
    for (const texto of ['Para el arriendo', 'Préstamo recibido', '$ 200.000', '$ 500.000']) {
      expect(screen.getByText(texto)).toBeOnTheScreen();
    }
    expect(plano()).toContain('20 de septiembre de 2026');
    expect(plano()).toContain('15 de agosto de 2026');
    expect(boton('Eliminar el préstamo de $ 200.000, 20 de septiembre de 2026')).toBeOnTheScreen();
    expect(boton('Eliminar el préstamo de $ 500.000, 15 de agosto de 2026')).toBeOnTheScreen();
    const texto = plano();
    expect(texto.indexOf('Para el arriendo')).toBeLessThan(texto.indexOf('Préstamo recibido'));
    expect(texto.indexOf('$ 200.000')).toBeLessThan(texto.indexOf('$ 500.000'));
  });

  it('CA-RF35-F07 no suma montos ni muestra saldo, abonos o cuotas', async () => {
    await mostrar();

    expect(plano()).not.toMatch(/700\.000|Debes|Valor total|abon|cuota|saldo|Pagada/i);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it.each([
    ['TASA', 0.02, 'Interés: 2 % al mes'],
    ['MONTO_FIJO', 50000, 'Interés total: $ 50.000'],
  ] as const)(
    'CA-RF35-F07 con interés %s dice sus condiciones',
    async (tipoInteres, valorInteres, texto) => {
      const deuda = { ...PAPA, tipoInteres, valorInteres };
      listar().mockResolvedValue([deuda]);

      await mostrar(deuda);

      expect(screen.getByText(texto)).toBeOnTheScreen();
    },
  );

  it('CA-RF34-F07 una deuda pagada muestra "Pagada" junto al interés', async () => {
    await mostrar(PAPA_PAGADA);
    await act(async () => {});

    expect(plano()).toMatch(/Sin interés.{0,5}Pagada/);
    // Es la deuda del id de la ruta, no otra de la misma persona
    expect(screen.getByText('Mercado')).toBeOnTheScreen();
    expect(screen.queryByText('Para el arriendo')).toBeNull();
  });
});
