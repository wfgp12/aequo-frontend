import Registrar from '@/app/registrar';
import { listarCategorias } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  listarTarjetas,
  obtenerCuotaPrevia,
  registrarCompra,
  type CuotaPrevia,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  ALIMENTACION,
  AMEX_T,
  atras,
  campoCuotas,
  cuotaDe,
  dejarReloj,
  elegirCuotas,
  elegirTarjeta,
  escribirValor,
  esperar,
  hastaCuotas,
  hastaFecha,
  hastaResumen,
  hayCalculando,
  hayEstimacion,
  mesSiguiente,
  OPCION,
  plano,
  siguiente,
  TEXTO,
  usarReloj,
  vaciar,
  VISA_ID,
  VISA_T,
} from './ayudas/compra-tarjeta';
import { conCodigo, rutaNoEncontrada } from './ayudas/errores';
import { boton, pendiente, RED } from './ayudas/tarjetas';

// Registro de un egreso con tarjeta: cómo se pide la cuota estimada, qué pasa si falla y cómo se pasa a la fecha
// (criterios/05-compra-con-tarjeta.md, CA-RF26-F15 y CA-RF27-F07 a F16). Hoy es el 19 de noviembre de 2026 y la
// espera de 400 ms se controla con relojes simulados.
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

const cuota = (n: number) => opcion(`${n} cuotas`);
const opcion = (texto: string) => screen.getByRole('button', { name: texto });
const llamadas = () => cuotaPrevia.mock.calls.length;
const ultimaLlamada = () => cuotaPrevia.mock.calls[cuotaPrevia.mock.calls.length - 1];

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

async function llegar(opcionDeTarjeta = OPCION.visa, valor?: string) {
  await render(<Registrar />);
  await hastaCuotas(opcionDeTarjeta, valor);
}

describe('Cuota estimada: la espera de 400 ms al cambiar', () => {
  it('CA-RF27-F07 al cambiar de 6 a 12 antes de 400 ms no consulta, deja de ver la estimación anterior y consulta una sola vez, 400 ms después del último cambio', async () => {
    await llegar();
    expect(llamadas()).toBe(1);
    expect(hayEstimacion()).toBe(true);

    await fireEvent.press(cuota(6));
    await esperar(399);

    expect(llamadas()).toBe(1);
    expect(hayCalculando()).toBe(true);
    expect(hayEstimacion()).toBe(false);

    await fireEvent.press(cuota(12));
    await esperar(399);

    // Pasaron 798 ms desde el primer cambio, pero solo 399 desde el último: todavía no consulta
    expect(llamadas()).toBe(1);
    expect(hayCalculando()).toBe(true);

    await esperar(1);

    expect(llamadas()).toBe(2);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 12, primerPago: '2026-11' },
    ]);
    expect(plano()).toContain('$ 119.802 x 12');

    await esperar(5000);
    expect(llamadas()).toBe(2);
  });

  it('CA-RF27-F07 al escribir "2" y luego "4" en "Otra" consulta una sola vez con 24 cuotas', async () => {
    await llegar();
    await fireEvent.press(opcion('Otra'));

    await fireEvent.changeText(campoCuotas(), '2');
    await esperar(399);
    await fireEvent.changeText(campoCuotas(), '24');
    await esperar(399);

    expect(llamadas()).toBe(1);

    await esperar(1);

    expect(llamadas()).toBe(2);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 24, primerPago: '2026-11' },
    ]);
  });

  it('CA-RF27-F08 al tocar "Mes siguiente" consulta pasados 400 ms con el mes nuevo y las mismas cuotas, y muestra la respuesta nueva', async () => {
    await llegar();
    await elegirCuotas(12);
    expect(llamadas()).toBe(2);
    cuotaPrevia.mockResolvedValueOnce(cuotaDe(98765.4, '2027-12'));

    await mesSiguiente();
    await esperar(399);
    expect(llamadas()).toBe(2);
    await esperar(1);

    expect(llamadas()).toBe(3);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 12, primerPago: '2026-12' },
    ]);
    expect(plano()).toContain('$ 98.765 x 12');
  });
});

describe('Cuota estimada: respuestas atrasadas y estimación vigente', () => {
  it('CA-RF27-F09 si llega la respuesta de 12 y después la atrasada de 6, queda solo la de 12, también en el resumen', async () => {
    await llegar();
    const de6 = pendiente<CuotaPrevia>();
    const de12 = pendiente<CuotaPrevia>();
    cuotaPrevia.mockReturnValueOnce(de6.promesa).mockReturnValueOnce(de12.promesa);

    await fireEvent.press(cuota(6));
    await esperar(400);
    await fireEvent.press(cuota(12));
    await esperar(400);
    expect(llamadas()).toBe(3);

    await act(async () => de12.resolver(cuotaDe(10000, '2027-11')));
    expect(plano()).toContain('$ 10.000 x 12');

    await act(async () => de6.resolver(cuotaDe(20000, '2027-05')));

    expect(plano()).toContain('$ 10.000 x 12');
    expect(plano()).not.toContain('$ 20.000');
    await hastaFecha();
    await hastaResumen();
    expect(plano()).toContain('12 cuotas');
    expect(plano()).toContain('$ 10.000');
    expect(plano()).not.toContain('$ 20.000');
    expect(plano()).toContain('noviembre 2027');
    expect(plano()).not.toContain('mayo 2027');
  });

  it('CA-RF27-F09 si la atrasada de 6 llega antes que la de 12, no la muestra: sigue calculando hasta que llega la de 12', async () => {
    await llegar();
    const de6 = pendiente<CuotaPrevia>();
    const de12 = pendiente<CuotaPrevia>();
    cuotaPrevia.mockReturnValueOnce(de6.promesa).mockReturnValueOnce(de12.promesa);
    await fireEvent.press(cuota(6));
    await esperar(400);
    await fireEvent.press(cuota(12));
    await esperar(400);

    await act(async () => de6.resolver(cuotaDe(20000, '2027-05')));

    expect(hayCalculando()).toBe(true);
    expect(hayEstimacion()).toBe(false);
    expect(siguiente()).toBeDisabled();

    await act(async () => de12.resolver(cuotaDe(10000, '2027-11')));

    expect(plano()).toContain('$ 10.000 x 12');
    expect(plano()).not.toContain('$ 20.000');
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF27-F09 una respuesta atrasada de otro mes tampoco pisa la actual', async () => {
    await llegar();
    await elegirCuotas(12);
    const deNoviembre = pendiente<CuotaPrevia>();
    const deDiciembre = pendiente<CuotaPrevia>();
    cuotaPrevia.mockReturnValueOnce(deNoviembre.promesa).mockReturnValueOnce(deDiciembre.promesa);
    await mesSiguiente();
    await esperar(400);
    await mesSiguiente();
    await esperar(400);

    await act(async () => deDiciembre.resolver(cuotaDe(30000, '2028-01')));
    await act(async () => deNoviembre.resolver(cuotaDe(40000, '2027-12')));

    expect(plano()).toContain('$ 30.000 x 12');
    expect(plano()).not.toContain('$ 40.000');
  });

  it('CA-RF27-F10 al cambiar las cuotas o el mes la estimación anterior desaparece de inmediato y "Siguiente" se deshabilita hasta que llegue la nueva', async () => {
    await llegar();
    await elegirCuotas(12);
    expect(hayEstimacion()).toBe(true);
    expect(siguiente()).toBeEnabled();

    await fireEvent.press(cuota(6));

    expect(hayEstimacion()).toBe(false);
    expect(siguiente()).toBeDisabled();
    await esperar(400);
    expect(hayEstimacion()).toBe(true);
    expect(siguiente()).toBeEnabled();

    await mesSiguiente();

    expect(hayEstimacion()).toBe(false);
    expect(siguiente()).toBeDisabled();
    await esperar(400);
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF27-F10 al volver con "Atrás" desde la fecha y las cuotas, se pide de nuevo con los datos actuales', async () => {
    await llegar();
    await elegirCuotas(6);
    await mesSiguiente();
    await esperar(400);
    expect(llamadas()).toBe(3);
    await hastaFecha();

    await fireEvent.press(atras());
    await screen.findByText('¿Cuántas cuotas?');
    await vaciar();

    expect(llamadas()).toBe(4);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 6, primerPago: '2026-12' },
    ]);
    expect(plano()).toContain('$ 45.000 x 6');
  });

  it('CA-RF27-F10 si cambia el valor en el primer paso y vuelve a pasar por las cuotas, se pide con el valor nuevo', async () => {
    await llegar();
    for (const paso of ['¿Con cuál tarjeta fue?', '¿Cómo pagaste?', '2 de 5', '1 de 5']) {
      await fireEvent.press(atras());
      await screen.findByText(paso);
    }

    await escribirValor('2000000');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));
    await fireEvent.press(await screen.findByLabelText('Tarjeta crédito'));
    await screen.findByRole('button', { name: OPCION.visa });
    await elegirTarjeta(OPCION.visa);

    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 2000000, cuotas: 1, primerPago: '2026-11' },
    ]);
  });
});

describe('Cuota estimada: cuando "Otra" no tiene un número válido', () => {
  it.each(['', '0', '61'])(
    'CA-RF27-F11 con "Otra" y el campo en "%s" no pide nada, no muestra el bloque ni "Calculando" y "Siguiente" está deshabilitado',
    async (texto) => {
      await llegar();
      await fireEvent.press(opcion('Otra'));

      if (texto) await fireEvent.changeText(campoCuotas(), texto);
      await esperar(2000);

      expect(llamadas()).toBe(1);
      expect(hayEstimacion()).toBe(false);
      expect(hayCalculando()).toBe(false);
      expect(siguiente()).toBeDisabled();
    },
  );

  it('CA-RF27-F16 con cuotas inválidas "Siguiente" no hace nada y no avanza', async () => {
    await llegar();
    await fireEvent.press(opcion('Otra'));
    await fireEvent.changeText(campoCuotas(), '0');

    await fireEvent.press(siguiente());

    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cuándo fue?')).toBeNull();
  });
});

describe('Cuota estimada: si la vista previa falla', () => {
  it.each([
    ['500', new ApiError(500, 'x')],
    ['400', new ApiError(400, 'cuotas debe ser un entero')],
    ['422', new ApiError(422, 'x')],
  ])(
    'CA-RF27-F12 con un %s avisa en lugar del bloque, deja "Siguiente" apagado y "Reintentar" vuelve a consultar con los mismos datos',
    async (_codigo, fallo) => {
      cuotaPrevia.mockRejectedValueOnce(fallo);
      await llegar();

      expect(screen.getByText(TEXTO.errorCuota)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCuota);
      expect(hayEstimacion()).toBe(false);
      expect(hayCalculando()).toBe(false);
      expect(siguiente()).toBeDisabled();
      expect(screen.queryByText(/cuotas debe ser/)).toBeNull();

      const segunda = pendiente<CuotaPrevia>();
      cuotaPrevia.mockReturnValueOnce(segunda.promesa);
      await fireEvent.press(boton('Reintentar'));

      expect(hayCalculando()).toBe(true);
      expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
      expect(llamadas()).toBe(2);
      expect(cuotaPrevia.mock.calls[1]).toEqual(cuotaPrevia.mock.calls[0]);
      expect(siguiente()).toBeDisabled();

      await act(async () => segunda.resolver(cuotaDe(1254700, '2026-11')));

      expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
      expect(siguiente()).toBeEnabled();
    },
  );

  it('CA-RF27-F12 si cambia las cuotas el aviso se va y se pide de nuevo con los datos nuevos', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(500, 'x'));
    await llegar();
    expect(screen.getByText(TEXTO.errorCuota)).toBeOnTheScreen();

    await fireEvent.press(cuota(6));

    expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
    await esperar(400);
    expect(llamadas()).toBe(2);
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 1254700, cuotas: 6, primerPago: '2026-11' },
    ]);
    expect(plano()).toContain('$ 45.000 x 6');
  });

  it('CA-RF27-F12 si cambia el mes el aviso se va y se pide de nuevo con el mes nuevo', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(500, 'x'));
    await llegar();

    await mesSiguiente();

    expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
    await esperar(400);
    expect(ultimaLlamada()[1].primerPago).toBe('2026-12');
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF27-F13 sin conexión avisa con el mensaje de red, ofrece "Reintentar" y deja "Siguiente" apagado', async () => {
    cuotaPrevia.mockRejectedValueOnce(new NetworkError());
    await llegar();

    expect(screen.getByText(RED)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();
  });

  it('CA-RF27-F14 si la tarjeta ya no existe (404) lo dice sin "Reintentar", deja "Siguiente" apagado y "Atrás" lleva a la lista de tarjetas', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(404, 'Tarjeta no encontrada'));
    await llegar();

    expect(screen.getByText(TEXTO.tarjetaYaNoExiste)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.tarjetaYaNoExiste);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
    expect(siguiente()).toBeDisabled();

    await fireEvent.press(atras());

    expect(await screen.findByText('¿Con cuál tarjeta fue?')).toBeOnTheScreen();
  });

  it('CA-RF27-F15 ante un 401 el paso no muestra un aviso de error propio', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await llegar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
    expect(screen.queryByText(RED)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});

describe('Cuota estimada: pasar a la fecha y a la nota', () => {
  it('CA-RF27-F16 con la estimación a la vista "Siguiente" avanza a la fecha sin consultar de nuevo', async () => {
    await llegar();
    await elegirCuotas(6);
    const antes = llamadas();

    await fireEvent.press(siguiente());

    expect(await screen.findByText('¿Cuándo fue?')).toBeOnTheScreen();
    expect(llamadas()).toBe(antes);
    await esperar(2000);
    expect(llamadas()).toBe(antes);
  });

  it('CA-RF27-F16 mientras calcula "Siguiente" no hace nada y no avanza', async () => {
    cuotaPrevia.mockReturnValue(new Promise<CuotaPrevia>(() => undefined));
    await llegar();

    await fireEvent.press(siguiente());

    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cuándo fue?')).toBeNull();
  });

  it('CA-RF27-F16 con error "Siguiente" no hace nada y no avanza', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(500, 'x'));
    await llegar();

    await fireEvent.press(siguiente());

    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cuándo fue?')).toBeNull();
  });

  it('CA-RF26-F15 tras "Siguiente" ve "¿Cuándo fue?" con "Hoy" elegida, "Ayer" y "Otra fecha", y después la nota con el resumen', async () => {
    await llegar();
    await hastaFecha();

    expect(screen.getByRole('button', { name: 'Hoy' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ayer' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Otra fecha' })).toBeOnTheScreen();

    await hastaResumen();

    expect(screen.getByText('Resumen')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota')).toBeOnTheScreen();
  });

  it('CA-RF26-F15 "Atrás" en la fecha vuelve a las cuotas con las cuotas y el mes conservados', async () => {
    await llegar();
    await elegirCuotas(6);
    await mesSiguiente();
    await esperar(400);
    await hastaFecha();

    await fireEvent.press(atras());

    expect(await screen.findByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(opcion('6 cuotas')).toBeSelected();
    expect(opcion('1 cuota')).not.toBeSelected();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
  });
});

// criterios/08-codigos-de-error.md
describe('Cuota estimada: códigos de error', () => {
  it('CA-RNF04-11 con TARJETA_NO_ENCONTRADA dice que elija otra tarjeta, sin "Reintentar"', async () => {
    cuotaPrevia.mockRejectedValueOnce(conCodigo(404, 'TARJETA_NO_ENCONTRADA', 'otro texto'));

    await llegar();

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.tarjetaYaNoExiste);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(plano()).not.toContain('otro texto');
  });

  it('CA-RNF04-15 una dirección que no existe muestra el texto general con "Reintentar"', async () => {
    cuotaPrevia.mockRejectedValueOnce(rutaNoEncontrada());
    await llegar();

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCuota);
    expect(plano()).not.toContain('ya no existe');

    await fireEvent.press(boton('Reintentar'));
    await vaciar();

    expect(llamadas()).toBe(2);
    expect(hayEstimacion()).toBe(true);
  });

  it('CA-RNF04-17 con ERROR_INTERNO muestra el texto general con "Reintentar", sin el message ni el action', async () => {
    cuotaPrevia.mockRejectedValueOnce(
      conCodigo(
        500,
        'ERROR_INTERNO',
        'Internal server error',
        'Inténtalo de nuevo en unos minutos',
      ),
    );

    await llegar();

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCuota);
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(plano()).not.toMatch(/Internal server error|unos minutos/);
  });
});
