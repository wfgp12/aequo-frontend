import { ApiError, NetworkError } from '@/lib/api/client';
import {
  listarTarjetas,
  registrarAvance,
  registrarCompra,
  type CompraCredito,
} from '@/lib/api/tarjetas';
import { crearTransaccion } from '@/lib/api/transacciones';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { avanceHastaElResumen } from './ayudas/avance';
import {
  AMEX_ID,
  AMEX_T,
  atras,
  compraDe,
  cuotaDe,
  dejarReloj,
  elegirCuotas,
  elegirTarjeta,
  escribirValor,
  esperar,
  hastaFecha,
  hastaResumen,
  mesSiguiente,
  OPCION,
  plano,
  TECNICO,
  TEXTO,
  usarReloj,
  VISA_ID,
  VISA_T,
} from './ayudas/compra-tarjeta';
import {
  CON_TEXTO_GENERAL,
  conCodigo,
  desconocido,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import { boton, pendiente, RED, UUID } from './ayudas/tarjetas';

// Guardar el avance en efectivo desde el resumen (criterios/05-compra-con-tarjeta.md, CA-RF28-F08 a F13). El backend
// se simula en el borde de los adaptadores; hoy es el 19 de noviembre de 2026.
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
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
const avanzar = jest.mocked(registrarAvance);
const comprar = jest.mocked(registrarCompra);
const transaccion = jest.mocked(crearTransaccion);

const avanceDe = (parcial: Partial<CompraCredito> = {}) =>
  compraDe({
    tipo: 'AVANCE',
    categoriaId: null as never,
    descripcion: 'Avance en efectivo',
    valor: 500000,
    cuotas: 6,
    primerPago: '2026-12',
    mesUltimoPago: '2027-05',
    cuota: 89741.0851,
    ...parcial,
  });

const CUERPO_DEL_AVANCE = { valor: 500000, cuotas: 6, primerPago: '2026-12', fecha: '2026-11-19' };

const cuerpo = (n = 0) => avanzar.mock.calls[n][1];
const clave = (n = 0) => avanzar.mock.calls[n][2];
const guardar = () => screen.getByText('Guardar');
const hayGuardar = () => screen.queryByText('Guardar') !== null;

beforeEach(() => {
  usarReloj();
  mockBack.mockClear();
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  avanzar.mockReset().mockResolvedValue(avanceDe());
  comprar.mockReset();
  transaccion.mockReset();
});

afterEach(() => {
  dejarReloj();
});

describe('Guardar el avance: lo que se envía', () => {
  it('CA-RF28-F08 "Guardar" envía el avance con la tarjeta, las cuotas y el primer pago, una sola vez, con una clave UUID, sin categoría y sin crear una compra ni un movimiento', async () => {
    await avanceHastaElResumen();

    await fireEvent.press(guardar());

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(avanzar).toHaveBeenCalledTimes(1);
    expect(avanzar).toHaveBeenCalledWith(VISA_ID, CUERPO_DEL_AVANCE, expect.stringMatching(UUID));
    expect(Object.keys(cuerpo()).sort()).toEqual(['cuotas', 'fecha', 'primerPago', 'valor']);
    expect(typeof cuerpo().valor).toBe('number');
    expect(typeof cuerpo().cuotas).toBe('number');
    expect(comprar).not.toHaveBeenCalled();
    expect(transaccion).not.toHaveBeenCalled();
  });

  it('CA-RF28-F08 envía lo elegido: la otra tarjeta, el valor, las cuotas, el mes y la fecha de ayer', async () => {
    await avanceHastaElResumen({
      tarjeta: OPCION.amex,
      valor: '120000',
      cuotas: 12,
      meses: 2,
      ayer: true,
    });

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(avanzar).toHaveBeenCalledWith(
      AMEX_ID,
      { valor: 120000, cuotas: 12, primerPago: '2027-01', fecha: '2026-11-18' },
      expect.stringMatching(UUID),
    );
  });

  it.each([
    ['vacía', undefined],
    ['solo con espacios', '    '],
  ])('CA-RF28-F09 con la nota %s el cuerpo no lleva "descripcion"', async (_caso, nota) => {
    await avanceHastaElResumen();
    if (nota !== undefined) await fireEvent.changeText(screen.getByLabelText('Nota'), nota);

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(cuerpo()).not.toHaveProperty('descripcion');
    expect(cuerpo()).toEqual(CUERPO_DEL_AVANCE);
  });

  it.each([
    ['con espacios en los extremos', '  Arreglo del carro  ', 'Arreglo del carro'],
    ['de 200 caracteres', 'x'.repeat(200), 'x'.repeat(200)],
  ])('CA-RF28-F09 con la nota %s envía la descripción "%s"', async (_caso, nota, esperada) => {
    await avanceHastaElResumen();
    await fireEvent.changeText(screen.getByLabelText('Nota'), nota);

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(cuerpo()).toEqual({ ...CUERPO_DEL_AVANCE, descripcion: esperada });
  });
});

describe('Guardar el avance: el resultado', () => {
  it('CA-RF28-F10 ve "¡Listo!" con el avance, la cuota de la respuesta del guardado y la aclaración del dinero recibido, y "Listo" cierra la pantalla', async () => {
    // La vista previa dijo 89.000 y el guardado respondió 89.741: manda la respuesta del guardado
    await avanceHastaElResumen({ respuesta: cuotaDe(89000.2, '2027-05') });

    await fireEvent.press(guardar());

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(plano()).toContain(
      'Registramos tu avance de $ 500.000 con Visa Bancolombia, a 6 cuotas de $ 89.741. Este dinero entra como dinero recibido: no cuenta como ingreso propio.',
    );
    expect(plano()).not.toContain('89.000');

    await fireEvent.press(boton('Listo'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('CA-RF28-F11 mientras guarda "Guardar" muestra un indicador, "Guardar" y "Atrás" no se pueden tocar y el doble toque envía una sola solicitud', async () => {
    const respuesta = pendiente<CompraCredito>();
    avanzar.mockReturnValue(respuesta.promesa);
    await avanceHastaElResumen();
    const botonGuardar = boton('Guardar');

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(avanzar).toHaveBeenCalledTimes(1);
    expect(hayGuardar()).toBe(false);
    expect(botonGuardar).toBeDisabled();
    expect(boton('Atrás')).toBeDisabled();

    await act(async () => respuesta.resolver(avanceDe()));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(avanzar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no hay conexión', new NetworkError(), RED],
    ['responde 400', new ApiError(400, 'valor debe ser mayor que 0'), TEXTO.errorAvance],
    ['responde 422', new ApiError(422, 'La clave ya se usó con otro cuerpo'), TEXTO.errorAvance],
    ['responde 500', new ApiError(500, 'Internal server error'), TEXTO.errorAvance],
    ['responde 409', new ApiError(409, 'Todavía se está procesando'), TEXTO.procesandoAvance],
    [
      'responde 404 "Tarjeta no encontrada"',
      new ApiError(404, 'Tarjeta no encontrada'),
      TEXTO.tarjetaYaNoExiste,
    ],
  ])(
    'CA-RF28-F12 cuando %s ve el mensaje, el resumen queda intacto y al volver a tocar "Guardar" usa la misma clave y el mismo cuerpo',
    async (_caso, fallo, mensaje) => {
      avanzar.mockRejectedValueOnce(fallo);
      await avanceHastaElResumen();

      await fireEvent.press(guardar());

      expect(await screen.findByText(mensaje)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
      expect(plano()).not.toMatch(TECNICO);
      expect(plano()).not.toContain(fallo.message);
      expect(plano()).toContain('Valor $ 500.000');
      expect(plano()).toContain('Cuotas 6 cuotas');
      expect(screen.getByText('5 de 5')).toBeOnTheScreen();
      expect(hayGuardar()).toBe(true);

      await fireEvent.press(guardar());

      await screen.findByText('¡Listo!');
      expect(avanzar).toHaveBeenCalledTimes(2);
      expect(clave(1)).toMatch(UUID);
      expect(clave(1)).toBe(clave(0));
      expect(cuerpo(1)).toEqual(cuerpo(0));
    },
  );

  it('CA-RF28-F12 ante un 401 el resumen no muestra un aviso de error propio', async () => {
    avanzar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await avanceHastaElResumen();

    await fireEvent.press(guardar());
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorAvance)).toBeNull();
    expect(screen.queryByText(RED)).toBeNull();
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });
});

describe('Guardar el avance: la clave de idempotencia', () => {
  async function conUnPrimerFallo(opciones: Parameters<typeof avanceHastaElResumen>[0] = {}) {
    avanzar.mockRejectedValueOnce(new ApiError(500, 'x'));
    await avanceHastaElResumen(opciones);
    await fireEvent.press(guardar());
    await screen.findByText(TEXTO.errorAvance);
  }

  async function guardarDeNuevo() {
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    expect(avanzar).toHaveBeenCalledTimes(2);
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
  }

  it('CA-RF28-F13 si cambia la nota tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await fireEvent.changeText(screen.getByLabelText('Nota'), 'Arreglo del carro');
    await guardarDeNuevo();

    expect(cuerpo(1)).toEqual({ ...cuerpo(0), descripcion: 'Arreglo del carro' });
  });

  it('CA-RF28-F13 si cambia la fecha tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await fireEvent.press(atras());
    await fireEvent.press(await screen.findByRole('button', { name: 'Ayer' }));
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(1)).toEqual({ ...cuerpo(0), fecha: '2026-11-18' });
  });

  it('CA-RF28-F13 si cambia las cuotas tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await fireEvent.press(atras());
    await screen.findByText('¿Cuándo fue?');
    await fireEvent.press(atras());
    await screen.findByText('¿Cuántas cuotas?');
    await elegirCuotas(12);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).cuotas).toBe(6);
    expect(cuerpo(1).cuotas).toBe(12);
  });

  it('CA-RF28-F13 si cambia el mes tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await fireEvent.press(atras());
    await screen.findByText('¿Cuándo fue?');
    await fireEvent.press(atras());
    await screen.findByText('¿Cuántas cuotas?');
    await mesSiguiente();
    await esperar(400);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).primerPago).toBe('2026-12');
    expect(cuerpo(1).primerPago).toBe('2027-01');
  });

  it('CA-RF28-F13 si cambia la tarjeta tras el fallo, la nueva llamada lleva otra clave y la tarjeta nueva', async () => {
    await conUnPrimerFallo();

    for (const paso of [
      '¿Cuándo fue?',
      '¿Cuántas cuotas?',
      '¿Con cuál tarjeta necesitas el avance?',
    ]) {
      await fireEvent.press(atras());
      await screen.findByText(paso);
    }
    await elegirTarjeta(OPCION.amex);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(avanzar.mock.calls[0][0]).toBe(VISA_ID);
    expect(avanzar.mock.calls[1][0]).toBe(AMEX_ID);
  });

  it('CA-RF28-F13 si cambia el valor tras el fallo, la nueva llamada lleva otra clave y el valor nuevo', async () => {
    await conUnPrimerFallo();

    for (const paso of [
      '¿Cuándo fue?',
      '¿Cuántas cuotas?',
      '¿Con cuál tarjeta necesitas el avance?',
      '¿Cuánto dinero necesitas?',
    ]) {
      await fireEvent.press(atras());
      await screen.findByText(paso);
    }
    await escribirValor('750000');
    await screen.findByRole('button', { name: OPCION.visa });
    await elegirTarjeta(OPCION.visa);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).valor).toBe(500000);
    expect(cuerpo(1).valor).toBe(750000);
  });

  it('CA-RF28-F13 otro avance idéntico registrado más tarde lleva otra clave', async () => {
    const primera = await avanceHastaElResumen();
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    await primera.unmount();

    await avanceHastaElResumen();
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');

    expect(avanzar).toHaveBeenCalledTimes(2);
    expect(cuerpo(1)).toEqual(cuerpo(0));
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
  });
});

// criterios/08-codigos-de-error.md
describe('Guardar el avance: códigos de error', () => {
  async function fallar(fallo: Error) {
    avanzar.mockRejectedValueOnce(fallo);
    await avanceHastaElResumen();
    await fireEvent.press(guardar());
    return screen.findByRole('alert');
  }

  async function reintentar() {
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    expect(avanzar).toHaveBeenCalledTimes(2);
  }

  it('CA-RNF04-07 si todavía se está guardando pide esperar y reintenta con la misma clave', async () => {
    const alerta = await fallar(conCodigo(409, 'IDEMPOTENCIA_EN_PROCESO'));

    expect(alerta).toHaveTextContent(TEXTO.procesandoAvance);
    await reintentar();
    expect(clave(1)).toBe(clave(0));
  });

  it('CA-RNF04-08 si la clave ya se usó muestra el texto general y el siguiente intento lleva otra clave', async () => {
    const alerta = await fallar(conCodigo(422, 'IDEMPOTENCIA_CLAVE_REUTILIZADA'));

    expect(alerta).toHaveTextContent(TEXTO.errorAvance);
    await reintentar();
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
  });

  it('CA-RNF04-11 con TARJETA_NO_ENCONTRADA dice que la tarjeta ya no existe, sin depender del message', async () => {
    const alerta = await fallar(conCodigo(404, 'TARJETA_NO_ENCONTRADA', 'otro texto'));

    expect(alerta).toHaveTextContent(TEXTO.tarjetaYaNoExiste);
    expect(plano()).not.toContain('otro texto');
  });

  it.each(['Not Found', 'Categoría no encontrada'])(
    'CA-RNF04-13 con un 404 sin code (mensaje "%s") dice que la tarjeta ya no existe',
    async (mensaje) => {
      const alerta = await fallar(new ApiError(404, mensaje));

      expect(alerta).toHaveTextContent(TEXTO.tarjetaYaNoExiste);
      expect(plano()).not.toContain(mensaje);
    },
  );

  it('CA-RNF04-15 una dirección que no existe muestra el texto general', async () => {
    const alerta = await fallar(rutaNoEncontrada());

    expect(alerta).toHaveTextContent(TEXTO.errorAvance);
    expect(plano()).not.toContain('ya no existe');
  });

  it.each(CON_TEXTO_GENERAL)(
    '%s con %s muestra el texto general, sin lo que manda el servidor',
    async (_id, _code, fallo) => {
      const alerta = await fallar(fallo);

      expect(alerta).toHaveTextContent(TEXTO.errorAvance);
      expect(plano()).not.toContain(fallo.message);
    },
  );

  it('CA-RNF04-18 con un caso sin texto propio muestra el message y debajo el action', async () => {
    const alerta = await fallar(desconocido());

    expect(alerta).toHaveTextContent(MENSAJE_Y_ACCION);
    await reintentar();
  });
});
