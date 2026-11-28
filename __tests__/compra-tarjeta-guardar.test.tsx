import { listarCategorias } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  listarTarjetas,
  obtenerCuotaPrevia,
  registrarCompra,
  type CompraCredito,
} from '@/lib/api/tarjetas';
import { crearTransaccion } from '@/lib/api/transacciones';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  ALIMENTACION,
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
  llegarAlResumen,
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
  CODIGOS_Y_TECNICISMOS,
  CON_TEXTO_GENERAL,
  conCodigo,
  desconocido,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import { boton, pendiente, RED, UUID } from './ayudas/tarjetas';

// Guardar una compra con tarjeta desde el resumen (criterios/05-compra-con-tarjeta.md, CA-RF26-F16 a F25 y la parte de
// los avisos de F26). El backend se simula en el borde de los adaptadores; hoy es el 19 de noviembre de 2026.
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
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
const transaccion = jest.mocked(crearTransaccion);
const categorias = jest.mocked(listarCategorias);

const TRANSPORTE = { ...ALIMENTACION, id: 'cat-2', nombre: 'Transporte' };

const CUERPO_DE_LA_COMPRA = {
  descripcion: 'Alimentación',
  categoriaId: 'cat-1',
  valor: 1254700,
  cuotas: 12,
  primerPago: '2026-12',
  fecha: '2026-11-19',
};

const cuerpo = (n = 0) => comprar.mock.calls[n][1];
const clave = (n = 0) => comprar.mock.calls[n][2];
const guardar = () => screen.getByText('Guardar');
const hayGuardar = () => screen.queryByText('Guardar') !== null;

beforeEach(() => {
  usarReloj();
  mockBack.mockClear();
  categorias.mockReset().mockResolvedValue([ALIMENTACION, TRANSPORTE]);
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  comprar.mockReset().mockResolvedValue(compraDe());
  transaccion.mockReset();
});

afterEach(() => {
  dejarReloj();
});

describe('Guardar la compra: lo que se envía', () => {
  it('CA-RF26-F16 "Guardar" envía la compra con la tarjeta, las cuotas y el primer pago, una sola vez, con una clave UUID y sin crear un movimiento', async () => {
    await llegarAlResumen();

    await fireEvent.press(guardar());

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(comprar).toHaveBeenCalledTimes(1);
    expect(comprar).toHaveBeenCalledWith(VISA_ID, CUERPO_DE_LA_COMPRA, expect.stringMatching(UUID));
    expect(Object.keys(cuerpo()).sort()).toEqual([
      'categoriaId',
      'cuotas',
      'descripcion',
      'fecha',
      'primerPago',
      'valor',
    ]);
    expect(typeof cuerpo().valor).toBe('number');
    expect(typeof cuerpo().cuotas).toBe('number');
    expect(transaccion).not.toHaveBeenCalled();
  });

  it('CA-RF26-F16 con "Ayer" la fecha que se envía es la de ayer en YYYY-MM-DD', async () => {
    await llegarAlResumen({ ayer: true });

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(cuerpo().fecha).toBe('2026-11-18');
    expect(cuerpo()).toEqual({ ...CUERPO_DE_LA_COMPRA, fecha: '2026-11-18' });
  });

  it('CA-RF26-F16 envía lo elegido: la otra tarjeta, el valor, la categoría y el mes', async () => {
    await llegarAlResumen({ tarjeta: OPCION.amex, valor: '80000', cuotas: 6, meses: 2 });

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(comprar).toHaveBeenCalledWith(
      AMEX_ID,
      { ...CUERPO_DE_LA_COMPRA, valor: 80000, cuotas: 6, primerPago: '2027-01' },
      expect.stringMatching(UUID),
    );
  });

  it.each([
    ['vacía', undefined, 'Alimentación'],
    ['solo con espacios', '    ', 'Alimentación'],
    ['con espacios en los extremos', '  Nevera nueva  ', 'Nevera nueva'],
    ['de 200 caracteres', 'x'.repeat(200), 'x'.repeat(200)],
  ])(
    'CA-RF26-F17 con la nota %s la descripción que se envía es "%s"',
    async (_caso, nota, esperada) => {
      await llegarAlResumen();
      if (nota !== undefined) await fireEvent.changeText(screen.getByLabelText('Nota'), nota);

      await fireEvent.press(guardar());

      await screen.findByText('¡Listo!');
      expect(cuerpo().descripcion).toBe(esperada);
    },
  );
});

describe('Guardar la compra: el resultado', () => {
  it('CA-RF26-F18 ve "¡Listo!" con la compra, el nombre de la categoría y la tarjeta y la cuota de la respuesta del guardado, y "Listo" cierra el registro', async () => {
    // La vista previa dijo 119.000 y el guardado respondió 119.802: manda la respuesta del guardado
    await llegarAlResumen({ respuesta: cuotaDe(119000.2, '2027-11') });
    const consultas = cuotaPrevia.mock.calls.length;

    await fireEvent.press(guardar());

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(plano()).toContain(
      'Registramos tu compra de $ 1.254.700 en Alimentación con Visa Bancolombia, a 12 cuotas de $ 119.802.',
    );
    expect(plano()).not.toContain('119.000');
    expect(cuotaPrevia).toHaveBeenCalledTimes(consultas);
    expect(transaccion).not.toHaveBeenCalled();

    await fireEvent.press(boton('Listo'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('CA-RF26-F18 con una cuota lo dice en singular', async () => {
    comprar.mockResolvedValue(
      compraDe({
        tarjetaId: AMEX_ID,
        valor: 80000,
        cuotas: 1,
        cuota: 80000,
        primerPago: '2026-11',
        mesUltimoPago: '2026-11',
      }),
    );
    await llegarAlResumen({
      tarjeta: OPCION.amex,
      valor: '80000',
      cuotas: 1,
      meses: 0,
      respuesta: cuotaDe(80000, '2026-11', { cuotaUnicaSinInteres: true }),
    });

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(plano()).toContain(
      'Registramos tu compra de $ 80.000 en Alimentación con Amex, en 1 cuota de $ 80.000.',
    );
    expect(plano()).not.toContain('1 cuotas');
  });

  it('CA-RF26-F19 mientras guarda "Guardar" muestra un indicador, "Guardar" y "Atrás" no se pueden tocar y el doble toque envía una sola solicitud', async () => {
    const respuesta = pendiente<CompraCredito>();
    comprar.mockReturnValue(respuesta.promesa);
    await llegarAlResumen();
    const botonGuardar = boton('Guardar');

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(comprar).toHaveBeenCalledTimes(1);
    expect(hayGuardar()).toBe(false);
    expect(botonGuardar).toBeDisabled();
    expect(boton('Atrás')).toBeDisabled();
    await fireEvent.press(boton('Atrás'));
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();

    await act(async () => respuesta.resolver(compraDe()));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(comprar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF26-F20 sin conexión avisa, conserva todo, deja "Guardar" disponible y al reintentar usa la misma clave y el mismo cuerpo', async () => {
    comprar.mockRejectedValueOnce(new NetworkError());
    await llegarAlResumen();

    await fireEvent.press(guardar());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(plano()).toContain('Cuotas 12 cuotas');
    expect(plano()).toContain('Valor $ 1.254.700');
    expect(hayGuardar()).toBe(true);
    expect(boton('Atrás')).toBeEnabled();

    await fireEvent.press(guardar());

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(comprar).toHaveBeenCalledTimes(2);
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).toBe(clave(0));
    expect(cuerpo(1)).toEqual(cuerpo(0));
  });

  it('CA-RF26-F20 el aviso de red desaparece al lograr guardar', async () => {
    comprar.mockRejectedValueOnce(new NetworkError());
    await llegarAlResumen();
    await fireEvent.press(guardar());
    await screen.findByText(RED);

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(screen.queryByText(RED)).toBeNull();
  });

  it.each([
    ['400', new ApiError(400, 'valor debe ser mayor que 0, cuotas debe ser un entero')],
    ['422', new ApiError(422, 'La clave de idempotencia ya se usó con otro cuerpo')],
    ['500', new ApiError(500, 'Internal server error')],
  ])(
    'CA-RF26-F21 con un %s muestra el mensaje general, sin términos técnicos ni el mensaje del backend, con el resumen intacto y la misma clave al reintentar',
    async (_codigo, fallo) => {
      comprar.mockRejectedValueOnce(fallo);
      await llegarAlResumen();

      await fireEvent.press(guardar());

      expect(await screen.findByText(TEXTO.errorCompra)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCompra);
      expect(plano()).not.toMatch(TECNICO);
      expect(plano()).not.toContain(fallo.message);
      expect(plano()).toContain('Cuotas 12 cuotas');
      expect(screen.getByText('5 de 5')).toBeOnTheScreen();

      await fireEvent.press(guardar());

      await screen.findByText('¡Listo!');
      expect(comprar).toHaveBeenCalledTimes(2);
      expect(clave(1)).toBe(clave(0));
      expect(cuerpo(1)).toEqual(cuerpo(0));
    },
  );

  it('CA-RF26-F22 si todavía se está procesando (409) lo explica, "Guardar" vuelve a estar disponible y al tocarlo usa la misma clave', async () => {
    comprar.mockRejectedValueOnce(
      new ApiError(409, 'La solicitud con esa clave todavía se está procesando'),
    );
    await llegarAlResumen();

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.procesandoCompra)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.errorCompra)).toBeNull();
    expect(plano()).not.toMatch(TECNICO);
    expect(hayGuardar()).toBe(true);

    await fireEvent.press(guardar());

    await screen.findByText('¡Listo!');
    expect(clave(1)).toBe(clave(0));
  });

  // Reemplaza a CA-RF26-F23 (paquete 8.3.9, decisión D2): el texto de `message` ya no decide nada
  it.each(['Tarjeta no encontrada', 'Categoría no encontrada', 'Not Found'])(
    'CA-RNF04-13 con un 404 sin code y el mensaje "%s" ve el aviso que cubre los dos casos y el resumen sigue con lo elegido',
    async (mensajeDelBackend) => {
      comprar.mockRejectedValueOnce(new ApiError(404, mensajeDelBackend));
      await llegarAlResumen();

      await fireEvent.press(guardar());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La tarjeta o la categoría que elegiste ya no existe. Vuelve atrás y elige otra.',
      );
      expect(plano()).not.toContain(mensajeDelBackend);
      expect(plano()).toContain('Tarjeta Visa Bancolombia');
      expect(plano()).toContain('Categoría Alimentación');
      expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    },
  );

  it('CA-RF26-F25 ante un 401 el resumen no muestra un aviso de error propio', async () => {
    comprar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await llegarAlResumen();

    await fireEvent.press(guardar());
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCompra)).toBeNull();
    expect(screen.queryByText(RED)).toBeNull();
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });
});

describe('Guardar la compra: la clave de idempotencia', () => {
  /** Hace fallar el primer guardado y deja el resumen listo para tocar "Guardar" otra vez. */
  async function conUnPrimerFallo(opciones: Parameters<typeof llegarAlResumen>[0] = {}) {
    comprar.mockRejectedValueOnce(new ApiError(500, 'x'));
    await llegarAlResumen(opciones);
    await fireEvent.press(guardar());
    await screen.findByText(TEXTO.errorCompra);
  }

  async function volver(pasos: number) {
    for (let i = 0; i < pasos; i++) await fireEvent.press(atras());
  }

  async function guardarDeNuevo() {
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    expect(comprar).toHaveBeenCalledTimes(2);
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
  }

  it('CA-RF26-F24 si cambia la nota tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await fireEvent.changeText(screen.getByLabelText('Nota'), 'Nevera nueva');
    await guardarDeNuevo();

    expect(cuerpo(1)).toEqual({ ...cuerpo(0), descripcion: 'Nevera nueva' });
  });

  it('CA-RF26-F24 si cambia la fecha tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await volver(1);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ayer' }));
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(1)).toEqual({ ...cuerpo(0), fecha: '2026-11-18' });
  });

  it('CA-RF26-F24 si cambia las cuotas tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await volver(2);
    await screen.findByText('¿Cuántas cuotas?');
    await elegirCuotas(6);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(1).cuotas).toBe(6);
    expect(cuerpo(1).primerPago).toBe(cuerpo(0).primerPago);
  });

  it('CA-RF26-F24 si cambia el mes del primer pago tras el fallo, la nueva llamada lleva otra clave y el cuerpo nuevo', async () => {
    await conUnPrimerFallo();

    await volver(2);
    await screen.findByText('¿Cuántas cuotas?');
    await mesSiguiente();
    await esperar(400);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).primerPago).toBe('2026-12');
    expect(cuerpo(1).primerPago).toBe('2027-01');
  });

  it('CA-RF26-F24 si cambia la tarjeta tras el fallo, la nueva llamada lleva otra clave y la tarjeta nueva', async () => {
    await conUnPrimerFallo();

    await volver(3);
    await screen.findByText('¿Con cuál tarjeta fue?');
    await elegirTarjeta(OPCION.amex);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(comprar.mock.calls[0][0]).toBe(VISA_ID);
    expect(comprar.mock.calls[1][0]).toBe(AMEX_ID);
  });

  it('CA-RF26-F24 si cambia el valor tras el fallo, la nueva llamada lleva otra clave y el valor nuevo', async () => {
    await conUnPrimerFallo();

    for (const paso of [
      '¿Cuándo fue?',
      '¿Cuántas cuotas?',
      '¿Con cuál tarjeta fue?',
      '¿Cómo pagaste?',
    ]) {
      await fireEvent.press(atras());
      await screen.findByText(paso);
    }
    await fireEvent.press(atras());
    await screen.findByText('2 de 5');
    await fireEvent.press(atras());
    await screen.findByText('1 de 5');
    await escribirValor('2000000');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));
    await fireEvent.press(await screen.findByLabelText('Tarjeta crédito'));
    await screen.findByRole('button', { name: OPCION.visa });
    await elegirTarjeta(OPCION.visa);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).valor).toBe(1254700);
    expect(cuerpo(1).valor).toBe(2000000);
  });

  it('CA-RF26-F24 si cambia la categoría tras el fallo, la nueva llamada lleva otra clave y la categoría nueva', async () => {
    await conUnPrimerFallo();

    for (const paso of [
      '¿Cuándo fue?',
      '¿Cuántas cuotas?',
      '¿Con cuál tarjeta fue?',
      '¿Cómo pagaste?',
    ]) {
      await fireEvent.press(atras());
      await screen.findByText(paso);
    }
    await fireEvent.press(atras());
    await fireEvent.press(await screen.findByLabelText('Transporte'));
    await fireEvent.press(await screen.findByLabelText('Tarjeta crédito'));
    await screen.findByRole('button', { name: OPCION.visa });
    await elegirTarjeta(OPCION.visa);
    await hastaFecha();
    await hastaResumen();
    await guardarDeNuevo();

    expect(cuerpo(0).categoriaId).toBe('cat-1');
    expect(cuerpo(1).categoriaId).toBe('cat-2');
    expect(cuerpo(1).descripcion).toBe('Transporte');
  });

  it('CA-RF26-F24 una compra nueva con los mismos datos, después de guardar y volver a entrar, lleva otra clave', async () => {
    const primera = await llegarAlResumen();
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    await primera.unmount();

    await llegarAlResumen();
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');

    expect(comprar).toHaveBeenCalledTimes(2);
    expect(cuerpo(1)).toEqual(cuerpo(0));
    expect(clave(0)).toMatch(UUID);
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
  });
});

// criterios/08-codigos-de-error.md
describe('Guardar la compra: códigos de error', () => {
  /** Falla el primer guardado con `fallo`, espera el aviso y lo devuelve. */
  async function fallar(fallo: Error) {
    comprar.mockRejectedValueOnce(fallo);
    await llegarAlResumen();
    await fireEvent.press(guardar());
    return screen.findByRole('alert');
  }

  async function reintentar() {
    await fireEvent.press(guardar());
    await screen.findByText('¡Listo!');
    expect(comprar).toHaveBeenCalledTimes(2);
  }

  it('CA-RNF04-07 si todavía se está guardando pide esperar y reintenta con la misma clave', async () => {
    const alerta = await fallar(conCodigo(409, 'IDEMPOTENCIA_EN_PROCESO'));

    expect(alerta).toHaveTextContent(TEXTO.procesandoCompra);
    await reintentar();
    expect(clave(1)).toBe(clave(0));
  });

  it('CA-RNF04-08 si la clave ya se usó muestra el texto general y el siguiente intento lleva otra clave', async () => {
    const alerta = await fallar(conCodigo(422, 'IDEMPOTENCIA_CLAVE_REUTILIZADA'));

    expect(alerta).toHaveTextContent(TEXTO.errorCompra);
    expect(plano()).not.toMatch(CODIGOS_Y_TECNICISMOS);
    await reintentar();
    expect(clave(1)).toMatch(UUID);
    expect(clave(1)).not.toBe(clave(0));
    expect(cuerpo(1)).toEqual(cuerpo(0));
  });

  it.each([
    ['TARJETA_NO_ENCONTRADA', 'Categoría no encontrada', TEXTO.tarjetaYaNoExiste],
    ['TARJETA_NO_ENCONTRADA', 'otro texto', TEXTO.tarjetaYaNoExiste],
    ['CATEGORIA_NO_ENCONTRADA', 'Tarjeta no encontrada', TEXTO.categoriaYaNoExiste],
    ['CATEGORIA_NO_ENCONTRADA', 'otro texto', TEXTO.categoriaYaNoExiste],
  ])(
    'CA-RNF04-12 y CA-RNF04-03 con %s (mensaje "%s") dice qué ya no existe según el code, con el resumen intacto',
    async (code, mensaje, esperado) => {
      const alerta = await fallar(conCodigo(404, code, mensaje));

      expect(alerta).toHaveTextContent(esperado);
      expect(plano()).not.toContain(mensaje);
      expect(plano()).not.toMatch(CODIGOS_Y_TECNICISMOS);
      expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    },
  );

  it('CA-RNF04-15 una dirección que no existe muestra el texto general, no que algo ya no existe', async () => {
    const alerta = await fallar(rutaNoEncontrada());

    expect(alerta).toHaveTextContent(TEXTO.errorCompra);
    expect(plano()).not.toContain('ya no existe');
    await reintentar();
    expect(clave(1)).toBe(clave(0));
  });

  it.each(CON_TEXTO_GENERAL)(
    '%s con %s muestra el texto general, sin lo que manda el servidor, y reintenta con la misma clave',
    async (_id, _code, fallo) => {
      const alerta = await fallar(fallo);

      expect(alerta).toHaveTextContent(TEXTO.errorCompra);
      expect(plano()).not.toContain(fallo.message);
      expect(plano()).not.toMatch(CODIGOS_Y_TECNICISMOS);
      await reintentar();
      expect(clave(1)).toBe(clave(0));
    },
  );

  it('CA-RNF04-18 con un caso sin texto propio muestra el message y debajo el action, y deja reintentar', async () => {
    const alerta = await fallar(desconocido());

    expect(alerta).toHaveTextContent(MENSAJE_Y_ACCION);
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    await reintentar();
  });
});
