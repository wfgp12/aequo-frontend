import Tarjetas from '@/app/tarjetas';
import { ApiError } from '@/lib/api/client';
import { listarTarjetas, type Tarjeta } from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AMEX_T, VISA_T } from './ayudas/compra-tarjeta';
import { boton, pendiente, textoDePantalla } from './ayudas/tarjetas';

// El botón "Avance en efectivo" de "Mis tarjetas" (criterios/05-compra-con-tarjeta.md, CA-RF28-F01). El backend se
// simula en el borde del adaptador (lib/api/tarjetas); el recorrido real por el router está en
// integracion-avance-en-efectivo.test.tsx.
const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, navigate: mockNavigate }),
}));
jest.mock('@/lib/api/tarjetas', () => ({
  ...jest.requireActual('@/lib/api/tarjetas'),
  listarTarjetas: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
}));

const listar = jest.mocked(listarTarjetas);

const hayAvance = () => screen.queryByRole('button', { name: 'Avance en efectivo' }) !== null;

/** A dónde pidió ir la pantalla, sea con `push` o con `navigate`, con texto o con objeto. */
const destinos = () =>
  [...mockPush.mock.calls, ...mockNavigate.mock.calls].map(([destino]) =>
    typeof destino === 'string' ? destino : (destino as { pathname: string }).pathname,
  );

beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
});

describe('Mis tarjetas: avance en efectivo', () => {
  it('CA-RF28-F01 con tarjetas muestra, debajo de "+ Agregar tarjeta", el botón "Avance en efectivo"', async () => {
    await render(<Tarjetas />);
    await screen.findByRole('button', { name: '+ Agregar tarjeta' });

    expect(boton('Avance en efectivo')).toBeOnTheScreen();
    const texto = textoDePantalla();
    expect(texto.indexOf('+ Agregar tarjeta')).toBeLessThan(texto.indexOf('Avance en efectivo'));
  });

  it('CA-RF28-F01 al tocarlo lleva a /avance-en-efectivo', async () => {
    await render(<Tarjetas />);
    await screen.findByRole('button', { name: '+ Agregar tarjeta' });

    await fireEvent.press(boton('Avance en efectivo'));

    expect(destinos()).toEqual(['/avance-en-efectivo']);
  });

  it('CA-RF28-F01 mientras la lista carga el botón no se ve', async () => {
    const carga = pendiente<Tarjeta[]>();
    listar.mockReturnValue(carga.promesa);

    await render(<Tarjetas />);

    expect(hayAvance()).toBe(false);
    expect(screen.getByLabelText('Cargando tus tarjetas')).toBeOnTheScreen();

    await act(async () => carga.resolver([VISA_T]));

    expect(await screen.findByRole('button', { name: 'Avance en efectivo' })).toBeOnTheScreen();
  });

  it('CA-RF28-F01 si la lista falla el botón no se ve', async () => {
    listar.mockRejectedValue(new ApiError(500, 'x'));

    await render(<Tarjetas />);
    await screen.findByText('Reintentar');

    expect(hayAvance()).toBe(false);
  });

  it('CA-RF28-F01 si no hay tarjetas el botón no se ve (sí "+ Agregar tarjeta")', async () => {
    listar.mockResolvedValue([]);

    await render(<Tarjetas />);
    await screen.findByRole('button', { name: '+ Agregar tarjeta' });

    expect(hayAvance()).toBe(false);
  });

  it('CA-RF28-F01 el botón no cambia lo demás de la lista: una fila por tarjeta y "+ Agregar tarjeta"', async () => {
    await render(<Tarjetas />);
    await screen.findByRole('button', { name: '+ Agregar tarjeta' });

    expect(screen.getByRole('button', { name: 'Amex, Tasa 24,21 % E.A.' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Visa Bancolombia, Tasa 29,21 % E.A.' }),
    ).toBeOnTheScreen();
    expect(destinos()).toEqual([]);
  });
});
