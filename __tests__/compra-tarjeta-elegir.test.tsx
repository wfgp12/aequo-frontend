import Registrar from '@/app/registrar';
import { listarCategorias } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  crearTarjeta,
  listarTarjetas,
  obtenerCuotaPrevia,
  registrarCompra,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { crearTransaccion } from '@/lib/api/transacciones';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  ALIMENTACION,
  AMEX_T,
  dejarReloj,
  escribirValor,
  hastaMetodo,
  OPCION,
  TECNICO,
  TEXTO,
  usarReloj,
  VISA_T,
  vaciar,
} from './ayudas/compra-tarjeta';
import { crearServidorDeTarjetas } from './ayudas/datos-tarjetas';
import { boton, pendiente, RED, textoDePantalla, UUID, volverDeLaHoja } from './ayudas/tarjetas';

// Registro de un egreso con tarjeta, primera parte: elegir la tarjeta
// (criterios/05-compra-con-tarjeta.md, CA-RF26-F01, F03 a F10 y F26). El backend se simula en el borde de los
// adaptadores; la fecha está fija en el 19 de noviembre de 2026.
const mockBack = jest.fn();
let mockTipo = 'EGRESO';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({ tipo: mockTipo }),
  Redirect: () => null,
}));
jest.mock('@/lib/api/categorias', () => ({
  ...jest.requireActual('@/lib/api/categorias'),
  listarCategorias: jest.fn(),
}));
jest.mock('@/lib/api/tarjetas', () => ({
  ...jest.requireActual('@/lib/api/tarjetas'),
  listarTarjetas: jest.fn(),
  crearTarjeta: jest.fn(),
  obtenerCuotaPrevia: jest.fn(),
  registrarCompra: jest.fn(),
  registrarAvance: jest.fn(),
}));
jest.mock('@/lib/api/transacciones', () => ({
  ...jest.requireActual('@/lib/api/transacciones'),
  crearTransaccion: jest.fn(),
}));

const listar = jest.mocked(listarTarjetas);
const crear = jest.mocked(crearTarjeta);
const cuotaPrevia = jest.mocked(obtenerCuotaPrevia);
const comprar = jest.mocked(registrarCompra);
const transaccion = jest.mocked(crearTransaccion);
const categorias = jest.mocked(listarCategorias);

const agregar = () => boton('+ Agregar tarjeta');
const hayAgregar = () => screen.queryByRole('button', { name: '+ Agregar tarjeta' }) !== null;

async function hastaElMetodoYTarjeta() {
  await render(<Registrar />);
  await hastaMetodo();
  await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
}

async function mostrarTarjetas(tarjetas: Tarjeta[] = [AMEX_T, VISA_T]) {
  const servidor = crearServidorDeTarjetas(tarjetas);
  listar.mockImplementation(servidor.listar);
  crear.mockImplementation(servidor.crear);
  await hastaElMetodoYTarjeta();
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
  return servidor;
}

beforeEach(() => {
  usarReloj();
  mockTipo = 'EGRESO';
  mockBack.mockClear();
  categorias.mockReset().mockResolvedValue([ALIMENTACION]);
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  crear.mockReset();
  cuotaPrevia.mockReset().mockResolvedValue({
    cuota: 1254700,
    mesUltimoPago: '2026-11',
    tasaEAAplicada: 0.2921,
    cuotaUnicaSinInteres: false,
  });
  comprar.mockReset();
  transaccion.mockReset().mockResolvedValue({} as never);
});

afterEach(() => {
  dejarReloj();
});

describe('Registro con tarjeta: entrada y orden de los pasos', () => {
  it('CA-RF26-F01 al tocar "Tarjeta crédito" ve "¿Con cuál tarjeta fue?", sin aviso, sin la fecha y sin crear ningún movimiento', async () => {
    await hastaElMetodoYTarjeta();

    expect(await screen.findByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
    expect(screen.queryByText(/se podrán registrar muy pronto/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('¿Cuándo fue?')).toBeNull();
    expect(screen.queryByText('¿Cómo pagaste?')).toBeNull();
    expect(transaccion).not.toHaveBeenCalled();
  });

  it.each([
    ['Efectivo', 'EFECTIVO'],
    ['Tarjeta débito', 'DEBITO'],
    ['Transferencia', 'TRANSFERENCIA'],
  ])(
    'CA-RF26-F03 con "%s" no se pide tarjeta ni cuotas y al guardar se crea un movimiento, no una compra',
    async (etiqueta, metodo) => {
      await render(<Registrar />);
      await hastaMetodo('45000');

      await fireEvent.press(screen.getByLabelText(etiqueta));

      expect(await screen.findByText('¿Cuándo fue?')).toBeOnTheScreen();
      expect(screen.getByText('4 de 5')).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('Siguiente'));
      await fireEvent.press(await screen.findByText('Guardar'));
      expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();

      expect(transaccion).toHaveBeenCalledTimes(1);
      expect(transaccion).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'EGRESO', monto: 45000, metodoPago: metodo }),
        expect.stringMatching(UUID),
      );
      expect(listar).not.toHaveBeenCalled();
      expect(cuotaPrevia).not.toHaveBeenCalled();
      expect(comprar).not.toHaveBeenCalled();
    },
  );

  it('CA-RF26-F03 en un ingreso no existe "Tarjeta crédito"', async () => {
    mockTipo = 'INGRESO';
    await render(<Registrar />);
    await escribirValor('1254700');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));

    expect(await screen.findByText('¿Cómo lo recibiste?')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Tarjeta crédito')).toBeNull();
    expect(screen.getByLabelText('Efectivo')).toBeOnTheScreen();
  });
});

describe('Elegir la tarjeta: carga y fallos', () => {
  it('CA-RF26-F04 al llegar pide las tarjetas una sola vez y, mientras no responde, solo se ve el indicador y "Atrás"', async () => {
    const carga = pendiente<Tarjeta[]>();
    listar.mockReturnValue(carga.promesa);

    await hastaElMetodoYTarjeta();
    await vaciar();

    expect(listar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tarjeta de crédito')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargandoTarjetas)).toBeOnTheScreen();
    expect(hayAgregar()).toBe(false);
    expect(screen.queryByRole('button', { name: OPCION.amex })).toBeNull();
    expect(screen.queryByText(TEXTO.sinTarjetas)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(boton('Atrás')).toBeOnTheScreen();

    await act(async () => carga.resolver([AMEX_T]));

    expect(await screen.findByRole('button', { name: OPCION.amex })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoTarjetas)).toBeNull();
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['un error del servidor (500)', new ApiError(500, 'x'), TEXTO.errorTarjetas],
    ['no hay conexión', new NetworkError(), RED],
  ])(
    'CA-RF26-F05 cuando %s avisa, no muestra la lista y "Reintentar" vuelve a consultar',
    async (_caso, fallo, mensaje) => {
      const segunda = pendiente<Tarjeta[]>();
      listar.mockRejectedValueOnce(fallo).mockReturnValueOnce(segunda.promesa);

      await hastaElMetodoYTarjeta();

      expect(await screen.findByText(mensaje)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
      expect(hayAgregar()).toBe(false);
      expect(screen.queryByRole('button', { name: OPCION.amex })).toBeNull();

      await fireEvent.press(boton('Reintentar'));

      expect(screen.getByLabelText(TEXTO.cargandoTarjetas)).toBeOnTheScreen();
      expect(screen.queryByText(mensaje)).toBeNull();
      expect(listar).toHaveBeenCalledTimes(2);

      await act(async () => segunda.resolver([AMEX_T, VISA_T]));

      expect(await screen.findByRole('button', { name: OPCION.visa })).toBeOnTheScreen();
    },
  );

  it('CA-RF26-F05 ante un 401 el paso no muestra un aviso de error propio', async () => {
    listar.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await hastaElMetodoYTarjeta();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    await vaciar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorTarjetas)).toBeNull();
    expect(screen.queryByText(RED)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('CA-RF26-F06 sin tarjetas invita a agregar la primera y no muestra filas ni errores', async () => {
    await mostrarTarjetas([]);

    expect(screen.getByText(TEXTO.sinTarjetas)).toBeOnTheScreen();
    expect(agregar()).toBeOnTheScreen();
    expect(screen.queryByText(/^Tasa /)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Elegir la tarjeta: la lista', () => {
  it('CA-RF26-F07 muestra una opción por tarjeta con su nombre y su tasa, en el orden recibido, y al final "+ Agregar tarjeta" y "Atrás"', async () => {
    await mostrarTarjetas();

    expect(screen.getByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 24,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    const texto = textoDePantalla();
    expect(texto.indexOf('Amex')).toBeLessThan(texto.indexOf('Visa Bancolombia'));
    expect(texto.indexOf('Visa Bancolombia')).toBeLessThan(texto.indexOf('+ Agregar tarjeta'));
    expect(boton('Atrás')).toBeOnTheScreen();
    expect(texto).not.toMatch(/disponible|cupo|corte|pago|\$/i);
  });

  it('CA-RF26-F07 no reordena las tarjetas que llegan', async () => {
    listar.mockResolvedValue([{ ...VISA_T }, { ...AMEX_T }]);
    await hastaElMetodoYTarjeta();
    await screen.findByText('Amex');

    const texto = textoDePantalla();
    expect(texto.indexOf('Visa Bancolombia')).toBeLessThan(texto.indexOf('Amex'));
  });

  it('CA-RF26-F08 tocar una tarjeta avanza a las cuotas con esa tarjeta, sin enviar nada', async () => {
    await mostrarTarjetas();

    await fireEvent.press(boton(OPCION.visa));

    expect(await screen.findByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia · Tasa 29,21 % E.A.')).toBeOnTheScreen();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
    expect(comprar).not.toHaveBeenCalled();
    expect(transaccion).not.toHaveBeenCalled();
  });

  it('CA-RF26-F10 "Atrás" vuelve al método de pago sin enviar nada y conserva el valor', async () => {
    await mostrarTarjetas();

    await fireEvent.press(boton('Atrás'));

    expect(await screen.findByText('¿Cómo pagaste?')).toBeOnTheScreen();
    expect(comprar).not.toHaveBeenCalled();
    expect(transaccion).not.toHaveBeenCalled();
    expect(cuotaPrevia).not.toHaveBeenCalled();

    await fireEvent.press(boton('Atrás'));
    await screen.findByText('2 de 5');
    await fireEvent.press(boton('Atrás'));

    expect(await screen.findByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 1.254.700');
  });

  it('CA-RF26-F10 desde las cuotas "Atrás" vuelve a la lista de tarjetas', async () => {
    await mostrarTarjetas();
    await fireEvent.press(boton(OPCION.visa));
    await screen.findByText('¿Cuántas cuotas?');

    await fireEvent.press(boton('Atrás'));

    expect(await screen.findByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
    expect(comprar).not.toHaveBeenCalled();
  });
});

describe('Elegir la tarjeta: agregar una tarjeta sin salir del registro', () => {
  it('CA-RF26-F09 "+ Agregar tarjeta" abre la hoja "Nueva tarjeta" con sus campos', async () => {
    await mostrarTarjetas();

    await fireEvent.press(agregar());

    expect(await screen.findByText('Nueva tarjeta')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alias')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tasa de interés E.A.')).toBeOnTheScreen();
    expect(screen.getByText('Compras a 1 cuota sin intereses')).toBeOnTheScreen();
  });

  it('CA-RF26-F09 al crearla la hoja se cierra, la lista se pide otra vez y la tarjeta nueva es una opción más, sin avanzar y con el valor intacto', async () => {
    await mostrarTarjetas();
    await fireEvent.press(agregar());
    await screen.findByText('Nueva tarjeta');

    await fireEvent.changeText(screen.getByLabelText('Alias'), 'Nu');
    await fireEvent.changeText(screen.getByLabelText('Tasa de interés E.A.'), '20');
    await fireEvent.press(boton('Guardar tarjeta'));

    await waitFor(() => expect(screen.queryByText('Nueva tarjeta')).toBeNull());
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear).toHaveBeenCalledWith(
      { nombre: 'Nu', tasaEA: 0.2, cuotaUnicaSinInteres: false },
      expect.stringMatching(UUID),
    );
    expect(await screen.findByRole('button', { name: 'Nu, Tasa 20 % E.A.' })).toBeOnTheScreen();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cuántas cuotas?')).toBeNull();
    expect(cuotaPrevia).not.toHaveBeenCalled();

    await fireEvent.press(boton('Nu, Tasa 20 % E.A.'));
    await screen.findByText('¿Cuántas cuotas?');

    expect(cuotaPrevia).toHaveBeenCalledWith(
      'nueva-3',
      expect.objectContaining({ valor: 1254700 }),
    );
  });

  it('CA-RF26-F09 con "Volver" la hoja se cierra sin crear nada y el paso queda igual', async () => {
    await mostrarTarjetas();
    await fireEvent.press(agregar());
    await screen.findByText('Nueva tarjeta');

    await fireEvent.press(volverDeLaHoja('Nueva tarjeta'));

    await waitFor(() => expect(screen.queryByText('Nueva tarjeta')).toBeNull());
    expect(crear).not.toHaveBeenCalled();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: OPCION.visa })).toBeOnTheScreen();
  });

  it('CA-RF26-F09 sin tarjetas también se puede agregar la primera sin salir del registro', async () => {
    await mostrarTarjetas([]);

    await fireEvent.press(agregar());
    await screen.findByText('Nueva tarjeta');
    await fireEvent.changeText(screen.getByLabelText('Alias'), 'Nu');
    await fireEvent.changeText(screen.getByLabelText('Tasa de interés E.A.'), '20');
    await fireEvent.press(boton('Guardar tarjeta'));

    expect(await screen.findByRole('button', { name: 'Nu, Tasa 20 % E.A.' })).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.sinTarjetas)).toBeNull();
    expect(screen.queryByText('¿Cuántas cuotas?')).toBeNull();
  });
});

describe('Elegir la tarjeta: lenguaje y accesibilidad', () => {
  it('CA-RF26-F26 cada tarjeta se anuncia como un botón con su nombre y su tasa juntos y el paso no usa términos técnicos', async () => {
    await mostrarTarjetas();

    expect(screen.getByRole('button', { name: OPCION.amex })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: OPCION.visa })).toBeOnTheScreen();
    expect(textoDePantalla()).not.toMatch(TECNICO);
  });

  it.each([
    ['el aviso de error', new ApiError(500, 'x'), TEXTO.errorTarjetas],
    ['el aviso sin conexión', new NetworkError(), RED],
  ])(
    'CA-RF26-F26 %s se anuncia como alerta y no usa términos técnicos',
    async (_c, fallo, mensaje) => {
      listar.mockRejectedValue(fallo);
      await hastaElMetodoYTarjeta();

      expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
      expect(textoDePantalla()).not.toMatch(TECNICO);
    },
  );

  it('CA-RF26-F26 el estado vacío y el de carga no usan términos técnicos', async () => {
    await mostrarTarjetas([]);

    expect(textoDePantalla()).not.toMatch(TECNICO);
  });
});
