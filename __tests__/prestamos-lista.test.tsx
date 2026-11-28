import { ApiError, NetworkError } from '@/lib/api/client';
import type { DeudaConPrestamos } from '@/lib/api/deudas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  BANCOLOMBIA,
  dejarHoy,
  eliminar,
  fijarHoy,
  listar,
  montarLista,
  PAPA,
  PAPA_PAGADA,
  plano,
  registrar,
  TEXTO,
} from './ayudas/prestamos';
import { reiniciarRouter, router, volverAlFoco } from './ayudas/router-simulado';
import { boton, pendiente, RED, textosEnOrden } from './ayudas/tarjetas';

// "Mis préstamos" (criterios/06-prestamos.md, CA-RF34-F03 a F09 y CA-RF35-F05). El backend se simula en el borde
// del adaptador (lib/api/deudas).
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/deudas', () => ({
  listarDeudas: jest.fn(),
  registrarPrestamo: jest.fn(),
  eliminarPrestamo: jest.fn(),
}));

const REGISTRAR = '+ Registrar préstamo';
const hayRegistrar = () => screen.queryByRole('button', { name: REGISTRAR }) !== null;

async function mostrar(deudas: DeudaConPrestamos[] = [BANCOLOMBIA, PAPA]) {
  listar().mockResolvedValue(deudas);
  await montarLista();
  await screen.findByRole('button', { name: REGISTRAR });
}

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  listar().mockReset().mockResolvedValue([]);
  registrar().mockReset();
  eliminar().mockReset();
});
afterEach(() => dejarHoy());

describe('Mis préstamos: carga', () => {
  it('CA-RF34-F03 mientras carga ve el título, "Volver" y el indicador, sin filas, vacío ni botón de registrar', async () => {
    const carga = pendiente<DeudaConPrestamos[]>();
    listar().mockReturnValueOnce(carga.promesa);

    await montarLista();

    expect(screen.getByText('Mis préstamos')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.vacio)).toBeNull();
    expect(hayRegistrar()).toBe(false);
    expect(listar()).toHaveBeenCalledTimes(1);
    expect(registrar()).not.toHaveBeenCalled();
    expect(eliminar()).not.toHaveBeenCalled();

    await act(async () => carga.resolver([PAPA]));

    expect(await screen.findByText('Papá')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();
  });

  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['otro fallo', new ApiError(500, 'Internal server error'), TEXTO.errorCarga],
  ])('CA-RF34-F04 %s: avisa y "Reintentar" vuelve a consultar', async (_caso, fallo, mensaje) => {
    listar().mockRejectedValueOnce(fallo).mockResolvedValueOnce([PAPA]);
    await montarLista();

    expect(await screen.findByText(mensaje)).toBeOnTheScreen();

    await fireEvent.press(boton('Reintentar'));

    expect(await screen.findByText('Papá')).toBeOnTheScreen();
    expect(screen.queryByText(mensaje)).toBeNull();
    expect(listar()).toHaveBeenCalledTimes(2);
  });

  it('CA-RF34-F04 ante un 401 no muestra un aviso propio', async () => {
    listar().mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await montarLista();
    await waitFor(() => expect(listar()).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('CA-RF34-F05 sin préstamos invita a registrar el primero', async () => {
    await mostrar([]);

    expect(screen.getByText(TEXTO.vacio)).toBeOnTheScreen();
    expect(boton(REGISTRAR)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Mis préstamos: las filas', () => {
  it('CA-RF34-F06 una fila por deuda, en el orden del backend, con interés y cantidad, y debajo el botón y la nota', async () => {
    await mostrar([BANCOLOMBIA, PAPA]);

    expect(screen.getByText('Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Interés: 2 % al mes · 1 préstamo')).toBeOnTheScreen();
    expect(screen.getByText('Papá')).toBeOnTheScreen();
    expect(screen.getByText('Sin interés · 2 préstamos')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.vacio)).toBeNull();
    const textos = textosEnOrden();
    expect(textos.indexOf('Bancolombia')).toBeLessThan(textos.indexOf('Papá'));
    expect(textos.indexOf('Papá')).toBeLessThan(textos.indexOf(REGISTRAR));
    expect(textos.indexOf('Papá')).toBeLessThan(textos.indexOf(TEXTO.nota));
  });

  it('CA-RF34-F06 no muestra montos, saldo, total ni cuotas', async () => {
    await mostrar();

    expect(plano()).not.toMatch(/\$|saldo|Debes en total|cuota|Pagada/i);
  });

  it('CA-RF34-F06 conserva el orden en que llegan, sin reordenar por nombre', async () => {
    await mostrar([PAPA, BANCOLOMBIA]);

    const textos = textosEnOrden();
    expect(textos.indexOf('Papá')).toBeLessThan(textos.indexOf('Bancolombia'));
  });

  it('CA-RF34-F06 el interés de valor fijo se dice con el total en pesos', async () => {
    await mostrar([{ ...BANCOLOMBIA, tipoInteres: 'MONTO_FIJO', valorInteres: 50000 }]);

    expect(screen.getByText('Interés total: $ 50.000 · 1 préstamo')).toBeOnTheScreen();
  });

  it('CA-RF34-F07 una deuda pagada se marca en su fila', async () => {
    await mostrar([PAPA_PAGADA]);

    expect(screen.getByText('Sin interés · 1 préstamo · Pagada')).toBeOnTheScreen();
  });

  it('CA-RF34-F08 al volver a la lista se consulta de nuevo y muestra lo que responda', async () => {
    await mostrar([PAPA]);
    listar().mockResolvedValue([BANCOLOMBIA, PAPA]);

    await volverAlFoco();

    expect(await screen.findByText('Bancolombia')).toBeOnTheScreen();
    expect(listar()).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['con préstamos', [PAPA]],
    ['sin préstamos', [] as DeudaConPrestamos[]],
  ])('CA-RF34-F09 %s, "+ Registrar préstamo" abre el registro', async (_caso, deudas) => {
    await mostrar(deudas);

    await fireEvent.press(boton(REGISTRAR));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/registrar-prestamo');
  });

  it('CA-RF35-F05 tocar una fila abre el detalle con el id y el nombre', async () => {
    await mostrar();

    await fireEvent.press(screen.getByText('Papá'));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/prestamos/[id]',
      params: { id: 'deuda-papa', nombre: 'Papá' },
    });
  });
});
