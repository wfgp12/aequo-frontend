import Registrar from '@/app/registrar';
import { listarCategorias } from '@/lib/api/categorias';
import {
  listarTarjetas,
  obtenerCuotaPrevia,
  registrarCompra,
  type CuotaPrevia,
} from '@/lib/api/tarjetas';
import { fechaLarga } from '@/lib/fechas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  ALIMENTACION,
  AMEX_ID,
  AMEX_T,
  atras,
  campoCuotas,
  cuotaDe,
  dejarReloj,
  elegirCuotas,
  esNumerico,
  esperar,
  hastaCuotas,
  hastaFecha,
  hastaResumen,
  hastaTarjetas,
  hayCalculando,
  hayEstimacion,
  mesAnterior,
  mesSiguiente,
  OPCION,
  plano,
  siguiente,
  TEXTO,
  usarReloj,
  VISA_ID,
  VISA_T,
  elegirTarjeta,
} from './ayudas/compra-tarjeta';

// Registro de un egreso con tarjeta, segunda parte: las cuotas, el mes del primer pago y la cuota estimada
// (criterios/05-compra-con-tarjeta.md, CA-RF26-F02 y F11 a F14, CA-RF27-F03 a F06). Hoy es el 19 de noviembre de
// 2026 (reloj simulado).
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({ tipo: 'EGRESO' }),
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
const cuotaPrevia = jest.mocked(obtenerCuotaPrevia);
const comprar = jest.mocked(registrarCompra);
const categorias = jest.mocked(listarCategorias);

const POR_CUOTAS: Record<number, number> = {
  1: 1254700,
  3: 418233.5,
  6: 45000.4,
  12: 119802.1331718775,
};

const llamada = (n: number) => cuotaPrevia.mock.calls[n];
const ultimaLlamada = () => cuotaPrevia.mock.calls[cuotaPrevia.mock.calls.length - 1];
const opcionDeCuotas = (texto: string) => screen.getByRole('button', { name: texto });

beforeEach(() => {
  usarReloj();
  categorias.mockReset().mockResolvedValue([ALIMENTACION]);
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  comprar.mockReset();
  cuotaPrevia
    .mockReset()
    .mockImplementation(async (_id, { cuotas }) => cuotaDe(POR_CUOTAS[cuotas] ?? 5000));
});

afterEach(() => {
  dejarReloj();
});

async function llegar(opcion = OPCION.visa, valor?: string) {
  await render(<Registrar />);
  await hastaCuotas(opcion, valor);
}

describe('Registro con tarjeta: encabezado de los pasos', () => {
  it('CA-RF26-F02 tarjeta y cuotas cuentan como el paso 3 de 5 con el título "Tarjeta de crédito"; la fecha es el 4 y la nota con el resumen, el 5', async () => {
    await render(<Registrar />);
    await hastaTarjetas();

    expect(screen.getByText('Tarjeta de crédito')).toBeOnTheScreen();
    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    expect(screen.queryByText('Nuevo egreso')).toBeNull();

    await elegirTarjeta(OPCION.visa);

    expect(screen.getByText('Tarjeta de crédito')).toBeOnTheScreen();
    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Paso 3 de 5')).toBeOnTheScreen();

    await hastaFecha();

    expect(screen.getByText('Nuevo egreso')).toBeOnTheScreen();
    expect(screen.getByText('4 de 5')).toBeOnTheScreen();

    await hastaResumen();

    expect(screen.getByText('Nuevo egreso')).toBeOnTheScreen();
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
  });
});

describe('Cuotas: lo que contiene el paso', () => {
  it('CA-RF26-F11 muestra el título, la tarjeta con su tasa, las cuotas 1, 3, 6, 12 y "Otra" (con "1" elegida), el mes del primer pago, "Atrás" y "Siguiente"', async () => {
    await llegar();

    expect(screen.getByText('Tarjeta de crédito')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia · Tasa 29,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    for (const texto of ['1 cuota', '3 cuotas', '6 cuotas', '12 cuotas', 'Otra']) {
      expect(opcionDeCuotas(texto)).toBeOnTheScreen();
    }
    expect(opcionDeCuotas('1 cuota')).toBeSelected();
    expect(opcionDeCuotas('3 cuotas')).not.toBeSelected();
    expect(opcionDeCuotas('Otra')).not.toBeSelected();
    expect(screen.getByText('¿En qué mes pagas la primera cuota?')).toBeOnTheScreen();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(atras()).toBeOnTheScreen();
    expect(siguiente()).toBeOnTheScreen();
    expect(screen.queryByLabelText('Número de cuotas')).toBeNull();
  });

  it('CA-RF26-F11 con otra tarjeta el subtítulo dice su nombre y su tasa', async () => {
    await llegar(OPCION.amex);

    expect(screen.getByText('Amex · Tasa 24,21 % E.A.')).toBeOnTheScreen();
  });

  it('CA-RF26-F12 al tocar 3, 6 o 12 esa opción queda elegida y la anterior deja de estarlo', async () => {
    await llegar();

    await fireEvent.press(opcionDeCuotas('6 cuotas'));
    expect(opcionDeCuotas('6 cuotas')).toBeSelected();
    expect(opcionDeCuotas('1 cuota')).not.toBeSelected();

    await fireEvent.press(opcionDeCuotas('3 cuotas'));
    expect(opcionDeCuotas('3 cuotas')).toBeSelected();
    expect(opcionDeCuotas('6 cuotas')).not.toBeSelected();

    await fireEvent.press(opcionDeCuotas('12 cuotas'));
    expect(opcionDeCuotas('12 cuotas')).toBeSelected();
    expect(opcionDeCuotas('3 cuotas')).not.toBeSelected();
    expect(opcionDeCuotas('1 cuota')).not.toBeSelected();
  });
});

describe('Cuotas: "Otra"', () => {
  it('CA-RF26-F13 "Otra" queda elegida, muestra el campo "Número de cuotas" vacío y numérico, deja "Siguiente" apagado y no pide ninguna cuota', async () => {
    await llegar();
    expect(cuotaPrevia).toHaveBeenCalledTimes(1);

    await fireEvent.press(opcionDeCuotas('Otra'));
    await esperar(1000);

    expect(opcionDeCuotas('Otra')).toBeSelected();
    expect(opcionDeCuotas('1 cuota')).not.toBeSelected();
    expect(campoCuotas().props.value ?? '').toBe('');
    expect(esNumerico(campoCuotas())).toBe(true);
    expect(siguiente()).toBeDisabled();
    expect(screen.queryByText(TEXTO.rangoCuotas)).toBeNull();
    expect(cuotaPrevia).toHaveBeenCalledTimes(1);
  });

  it('CA-RF26-F13 el campo solo acepta dígitos y como máximo dos, y con "24" se pide la cuota de 24 cuotas', async () => {
    await llegar();
    await fireEvent.press(opcionDeCuotas('Otra'));

    await fireEvent.changeText(campoCuotas(), '2a4');
    expect(campoCuotas().props.value).toBe('24');

    await fireEvent.changeText(campoCuotas(), '245');
    expect(campoCuotas().props.value).toBe('24');

    await esperar(400);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 24, primerPago: '2026-11' },
    ]);
  });

  it.each(['0', '61', '99'])(
    'CA-RF26-F13 con "%s" avisa "Las cuotas van de 1 a 60." y "Siguiente" queda deshabilitado',
    async (texto) => {
      await llegar();
      await fireEvent.press(opcionDeCuotas('Otra'));

      await fireEvent.changeText(campoCuotas(), texto);
      await esperar(1000);

      expect(screen.getByText(TEXTO.rangoCuotas)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.rangoCuotas);
      expect(siguiente()).toBeDisabled();
      expect(cuotaPrevia).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['1', '60'])(
    'CA-RF26-F13 con "%s" es válido: sin aviso y se pide esa cantidad de cuotas',
    async (texto) => {
      await llegar();
      await elegirCuotas(3);
      const antes = cuotaPrevia.mock.calls.length;
      await fireEvent.press(opcionDeCuotas('Otra'));

      await fireEvent.changeText(campoCuotas(), texto);
      await esperar(400);

      expect(screen.queryByText(TEXTO.rangoCuotas)).toBeNull();
      expect(cuotaPrevia).toHaveBeenCalledTimes(antes + 1);
      expect(ultimaLlamada()).toEqual([
        VISA_ID,
        { valor: 1254700, cuotas: Number(texto), primerPago: '2026-11' },
      ]);
      expect(siguiente()).toBeEnabled();
    },
  );

  it('CA-RF26-F13 el aviso se va al corregir el número', async () => {
    await llegar();
    await fireEvent.press(opcionDeCuotas('Otra'));
    await fireEvent.changeText(campoCuotas(), '61');
    expect(screen.getByText(TEXTO.rangoCuotas)).toBeOnTheScreen();

    await fireEvent.changeText(campoCuotas(), '6');

    expect(screen.queryByText(TEXTO.rangoCuotas)).toBeNull();
  });

  it('CA-RF26-F13 al volver a tocar una opción fija esa queda elegida y el campo se oculta', async () => {
    await llegar();
    await fireEvent.press(opcionDeCuotas('Otra'));
    await fireEvent.changeText(campoCuotas(), '24');

    await fireEvent.press(opcionDeCuotas('12 cuotas'));

    expect(opcionDeCuotas('12 cuotas')).toBeSelected();
    expect(opcionDeCuotas('Otra')).not.toBeSelected();
    expect(screen.queryByLabelText('Número de cuotas')).toBeNull();
    expect(screen.queryByText(TEXTO.rangoCuotas)).toBeNull();
  });
});

describe('Cuotas: mes del primer pago', () => {
  it('CA-RF26-F14 empieza en noviembre 2026 (el mes de hoy) y se mueve con "Mes siguiente" y "Mes anterior"', async () => {
    await llegar();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();

    await mesSiguiente();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('noviembre 2026')).toBeNull();

    await mesAnterior();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
  });

  it('CA-RF26-F14 puede ir hacia atrás y hacia adelante sin tope y cruza el año en los dos sentidos', async () => {
    await llegar();

    await mesSiguiente();
    await mesSiguiente();
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    await mesSiguiente(13);
    expect(screen.getByText('febrero 2028')).toBeOnTheScreen();

    await mesAnterior(15);
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    await mesAnterior(10);
    expect(screen.getByText('enero 2026')).toBeOnTheScreen();
    await mesAnterior();
    expect(screen.getByText('diciembre 2025')).toBeOnTheScreen();
  });

  it('CA-RF26-F14 lo que se envía es el mes como texto YYYY-MM, con el cero de los meses de un dígito', async () => {
    await llegar();

    await mesSiguiente();
    await esperar(400);
    expect(ultimaLlamada()[1]).toEqual({ valor: 1254700, cuotas: 1, primerPago: '2026-12' });

    await mesSiguiente();
    await esperar(400);
    expect(ultimaLlamada()[1].primerPago).toBe('2027-01');

    await mesAnterior(11);
    await esperar(400);
    expect(ultimaLlamada()[1].primerPago).toBe('2026-02');

    await mesAnterior(2);
    await esperar(400);
    expect(ultimaLlamada()[1].primerPago).toBe('2025-12');
  });

  it('CA-RF26-F14 al elegir una fecha de otro mes el mes del primer pago no cambia solo, ni al volver con "Atrás"', async () => {
    await llegar();
    await mesSiguiente();
    await esperar(400);
    await hastaFecha();

    await fireEvent.press(screen.getByText('Otra fecha'));
    await fireEvent.press(screen.getByLabelText('Mes anterior'));
    await fireEvent.press(screen.getByLabelText(fechaLarga('2026-10-06')));
    await fireEvent.press(atras());

    expect(await screen.findByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
  });
});

describe('Cuota estimada: cuándo se pide', () => {
  it('CA-RF27-F03 antes de las cuotas no se pide nada y al llegar se pide una sola vez con el valor, 1 cuota y el mes de hoy', async () => {
    await render(<Registrar />);
    await hastaTarjetas();

    expect(cuotaPrevia).not.toHaveBeenCalled();

    await elegirTarjeta(OPCION.visa);

    expect(cuotaPrevia).toHaveBeenCalledTimes(1);
    expect(cuotaPrevia).toHaveBeenCalledWith(VISA_ID, {
      valor: 1254700,
      cuotas: 1,
      primerPago: '2026-11',
    });
    expect(Object.keys(llamada(0)[1]).sort()).toEqual(['cuotas', 'primerPago', 'valor']);
  });

  it('CA-RF27-F03 el valor y la tarjeta que se piden son los elegidos', async () => {
    await llegar(OPCION.amex, '80000');

    expect(cuotaPrevia).toHaveBeenCalledTimes(1);
    expect(cuotaPrevia).toHaveBeenCalledWith(AMEX_ID, {
      valor: 80000,
      cuotas: 1,
      primerPago: '2026-11',
    });
  });
});

describe('Cuota estimada: lo que se ve', () => {
  it('CA-RF27-F04 mientras no llega la respuesta ve "Calculando tu cuota" en lugar del bloque, "Siguiente" deshabilitado y lo demás funciona', async () => {
    cuotaPrevia.mockReturnValue(new Promise<CuotaPrevia>(() => undefined));

    await llegar();

    expect(hayCalculando()).toBe(true);
    expect(hayEstimacion()).toBe(false);
    expect(siguiente()).toBeDisabled();
    expect(atras()).toBeEnabled();

    await fireEvent.press(opcionDeCuotas('6 cuotas'));
    expect(opcionDeCuotas('6 cuotas')).toBeSelected();
    await mesSiguiente();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
  });

  it.each([
    [1254700, 6, 45000.4, '$ 45.000 x 6'],
    [1254700, 12, 119802.1331718775, '$ 119.802 x 12'],
    [1254700, 6, 45000.6, '$ 45.001 x 6'],
    [100, 3, 12345.6, '$ 12.346 x 3'],
  ])(
    'CA-RF27-F05 con valor %s y %s cuotas, si el backend responde %s ve "%s" y la nota',
    async (valor, cuotas, cuota, esperado) => {
      cuotaPrevia.mockImplementation(async (_id, consulta) =>
        consulta.cuotas === cuotas ? cuotaDe(cuota) : cuotaDe(valor),
      );
      await llegar(OPCION.visa, String(valor));

      await elegirCuotas(cuotas);

      expect(screen.getByText(/Cuota estimada/)).toBeOnTheScreen();
      expect(plano()).toContain(esperado);
      expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
      expect(hayCalculando()).toBe(false);
      expect(siguiente()).toBeEnabled();
    },
  );

  it('CA-RF27-F05 con una cuota estimada que no coincide con ninguna fórmula muestra la del backend: la pantalla no calcula', async () => {
    cuotaPrevia.mockImplementation(async () => cuotaDe(7));
    await llegar(OPCION.visa, '1000000');

    await elegirCuotas(12);

    expect(plano()).toContain('$ 7 x 12');
  });

  it('CA-RF27-F06 con 1 cuota y la cuota única sin interés explica el pago único y no muestra el bloque', async () => {
    cuotaPrevia.mockImplementation(async (_id, { valor }) =>
      cuotaDe(valor, '2026-11', { cuotaUnicaSinInteres: true, tasaEAAplicada: 0.2421 }),
    );
    await llegar(OPCION.amex, '80000');

    expect(screen.getByText(TEXTO.pagoUnico)).toBeOnTheScreen();
    expect(hayEstimacion()).toBe(false);
    expect(screen.queryByText(/Se paga el próximo ciclo/)).toBeNull();
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF27-F06 con 1 cuota y sin esa bandera muestra la cuota con interés ("x 1") y no el pago único', async () => {
    cuotaPrevia.mockImplementation(async () => cuotaDe(81726.8319, '2026-11'));
    await llegar(OPCION.visa, '80000');

    expect(screen.queryByText(TEXTO.pagoUnico)).toBeNull();
    expect(screen.getByText(/Cuota estimada/)).toBeOnTheScreen();
    expect(plano()).toContain('$ 81.727 x 1');
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
  });

  it.each([
    [3, '$ 30.000 x 3'],
    [6, '$ 15.000 x 6'],
    [12, '$ 7.500 x 12'],
  ])(
    'CA-RF27-F06 con %s cuotas siempre ve el bloque (%s) y no la frase del pago único',
    async (cuotas, esperado) => {
      cuotaPrevia.mockImplementation(async (_id, { valor, cuotas: n }) =>
        cuotaDe(valor / n, '2027-04', { cuotaUnicaSinInteres: true }),
      );
      await llegar(OPCION.amex, '90000');
      expect(screen.getByText(TEXTO.pagoUnico)).toBeOnTheScreen();

      await elegirCuotas(cuotas);

      expect(screen.queryByText(TEXTO.pagoUnico)).toBeNull();
      expect(screen.getByText(/Cuota estimada/)).toBeOnTheScreen();
      expect(plano()).toContain(esperado);
    },
  );

  it('CA-RF27-F06 con "Otra" y más de una cuota ve el bloque', async () => {
    await llegar(OPCION.amex, '90000');
    await fireEvent.press(opcionDeCuotas('Otra'));

    await fireEvent.changeText(campoCuotas(), '24');
    await esperar(400);

    expect(screen.getByText(/Cuota estimada/)).toBeOnTheScreen();
    expect(plano()).toContain('x 24');
    expect(screen.queryByText(TEXTO.pagoUnico)).toBeNull();
  });
});
