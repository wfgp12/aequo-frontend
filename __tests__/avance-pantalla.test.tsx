import AvanceEnEfectivo from '@/app/avance-en-efectivo';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  crearTarjeta,
  listarTarjetas,
  obtenerCuotaPrevia,
  registrarAvance,
  registrarCompra,
  type CuotaPrevia,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { crearTransaccion } from '@/lib/api/transacciones';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { avanceHastaCuotas, avanceHastaElResumen, avanceHastaTarjetas } from './ayudas/avance';
import {
  AMEX_T,
  atras,
  campoCuotas,
  cuotaDe,
  dejarReloj,
  elegirCuotas,
  esperar,
  hastaFecha,
  hastaResumen,
  hayCalculando,
  hayEstimacion,
  mesSiguiente,
  OPCION,
  plano,
  siguiente,
  TECNICO,
  TEXTO,
  TIPO_AVANCE,
  usarReloj,
  vaciar,
  VISA_ID,
  VISA_T,
} from './ayudas/compra-tarjeta';
import { crearServidorDeTarjetas } from './ayudas/datos-tarjetas';
import { boton, pendiente, RED, UUID, volverDeLaHoja } from './ayudas/tarjetas';

// Pantalla del avance en efectivo, los pasos hasta el resumen (criterios/05-compra-con-tarjeta.md, CA-RF28-F03 a F07
// y F16). El backend se simula en el borde de los adaptadores; hoy es el 19 de noviembre de 2026.
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
const crear = jest.mocked(crearTarjeta);
const cuotaPrevia = jest.mocked(obtenerCuotaPrevia);
const avanzar = jest.mocked(registrarAvance);
const comprar = jest.mocked(registrarCompra);
const transaccion = jest.mocked(crearTransaccion);

const opcion = (texto: string) => screen.getByRole('button', { name: texto });
const llamadas = () => cuotaPrevia.mock.calls.length;
const ultimaLlamada = () => cuotaPrevia.mock.calls[cuotaPrevia.mock.calls.length - 1];
const nadaEnviado = () => {
  expect(avanzar).not.toHaveBeenCalled();
  expect(comprar).not.toHaveBeenCalled();
  expect(transaccion).not.toHaveBeenCalled();
};

beforeEach(() => {
  usarReloj();
  mockBack.mockClear();
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  crear.mockReset();
  cuotaPrevia.mockReset().mockResolvedValue(cuotaDe(500000, '2026-11'));
  avanzar.mockReset();
  comprar.mockReset();
  transaccion.mockReset();
});

afterEach(() => {
  dejarReloj();
});

describe('Avance en efectivo: el valor', () => {
  it('CA-RF28-F03 empieza por el valor: título, "1 de 5", la pregunta, el campo del monto y "Siguiente" apagado mientras esté vacío o en cero', async () => {
    await render(<AvanceEnEfectivo />);

    expect(screen.getByText('Avance en efectivo')).toBeOnTheScreen();
    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByText('¿Cuánto dinero necesitas?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos')).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '0');
    expect(siguiente()).toBeDisabled();
    await fireEvent.press(siguiente());
    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(listar).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');
    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 500.000');
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF28-F03 el campo solo acepta dígitos', async () => {
    await render(<AvanceEnEfectivo />);

    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '12a.3b');

    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 123');
  });

  it('CA-RF28-F03 el botón "Cerrar" vuelve a la pantalla anterior sin enviar nada', async () => {
    await render(<AvanceEnEfectivo />);
    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');

    await fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    nadaEnviado();
  });

  it('CA-RF28-F03 con un valor, "Siguiente" lleva a elegir la tarjeta (paso 2 de 5)', async () => {
    await avanceHastaTarjetas();

    expect(screen.getByText('2 de 5')).toBeOnTheScreen();
    expect(screen.getByText('Avance en efectivo')).toBeOnTheScreen();
    expect(screen.queryByText('¿Cuánto dinero necesitas?')).toBeNull();
  });
});

describe('Avance en efectivo: elegir la tarjeta', () => {
  it('CA-RF28-F04 pregunta "¿Con cuál tarjeta necesitas el avance?" y muestra una opción por tarjeta con su nombre y su tasa', async () => {
    await avanceHastaTarjetas();

    expect(screen.getByText('¿Con cuál tarjeta necesitas el avance?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: OPCION.amex })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: OPCION.visa })).toBeOnTheScreen();
    expect(boton('+ Agregar tarjeta')).toBeOnTheScreen();
    expect(boton('Atrás')).toBeOnTheScreen();
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF28-F04 mientras no responde la lista solo se ve el indicador y "Atrás"', async () => {
    const carga = pendiente<Tarjeta[]>();
    listar.mockReturnValue(carga.promesa);
    await render(<AvanceEnEfectivo />);
    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');
    await fireEvent.press(siguiente());

    expect(await screen.findByLabelText(TEXTO.cargandoTarjetas)).toBeOnTheScreen();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '+ Agregar tarjeta' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(boton('Atrás')).toBeOnTheScreen();

    await act(async () => carga.resolver([AMEX_T]));

    expect(await screen.findByRole('button', { name: OPCION.amex })).toBeOnTheScreen();
  });

  it.each([
    ['un error del servidor', new ApiError(500, 'x'), TEXTO.errorTarjetas],
    ['no hay conexión', new NetworkError(), RED],
  ])(
    'CA-RF28-F04 cuando %s avisa y "Reintentar" vuelve a consultar',
    async (_caso, fallo, mensaje) => {
      listar.mockRejectedValueOnce(fallo);
      await render(<AvanceEnEfectivo />);
      await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');
      await fireEvent.press(siguiente());

      expect(await screen.findByText(mensaje)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(mensaje);

      await fireEvent.press(boton('Reintentar'));

      expect(await screen.findByRole('button', { name: OPCION.visa })).toBeOnTheScreen();
      expect(listar).toHaveBeenCalledTimes(2);
    },
  );

  it('CA-RF28-F04 sin tarjetas invita a agregar la primera', async () => {
    listar.mockResolvedValue([]);

    await avanceHastaTarjetas();

    expect(screen.getByText(TEXTO.sinTarjetas)).toBeOnTheScreen();
    expect(boton('+ Agregar tarjeta')).toBeOnTheScreen();
  });

  it('CA-RF28-F04 "+ Agregar tarjeta" abre la hoja "Nueva tarjeta" sin salir del avance, y al crearla aparece como una opción más', async () => {
    const servidor = crearServidorDeTarjetas([AMEX_T, VISA_T]);
    listar.mockImplementation(servidor.listar);
    crear.mockImplementation(servidor.crear);
    await avanceHastaTarjetas();

    await fireEvent.press(boton('+ Agregar tarjeta'));
    await screen.findByText('Nueva tarjeta');
    await fireEvent.press(volverDeLaHoja('Nueva tarjeta'));
    await waitFor(() => expect(screen.queryByText('Nueva tarjeta')).toBeNull());
    expect(crear).not.toHaveBeenCalled();

    await fireEvent.press(boton('+ Agregar tarjeta'));
    await screen.findByText('Nueva tarjeta');
    await fireEvent.changeText(screen.getByLabelText('Alias'), 'Nu');
    await fireEvent.changeText(screen.getByLabelText('Tasa de interés E.A.'), '20');
    await fireEvent.press(boton('Guardar tarjeta'));

    expect(await screen.findByRole('button', { name: 'Nu, Tasa 20 % E.A.' })).toBeOnTheScreen();
    expect(screen.getByText('¿Con cuál tarjeta necesitas el avance?')).toBeOnTheScreen();
    expect(crear).toHaveBeenCalledWith(
      { nombre: 'Nu', tasaEA: 0.2, cuotaUnicaSinInteres: false },
      expect.stringMatching(UUID),
    );
  });

  it('CA-RF28-F04 "Atrás" vuelve al valor, conservado, y tocar una tarjeta avanza a las cuotas (paso 3 de 5)', async () => {
    await avanceHastaTarjetas();

    await fireEvent.press(boton('Atrás'));

    expect(await screen.findByText('¿Cuánto dinero necesitas?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 500.000');

    await fireEvent.press(siguiente());
    await screen.findByRole('button', { name: OPCION.visa });
    await fireEvent.press(boton(OPCION.visa));

    expect(await screen.findByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    nadaEnviado();
  });
});

describe('Avance en efectivo: cuotas, mes del primer pago y cuota estimada', () => {
  it('CA-RF28-F05 muestra el título "Avance en efectivo", las cuotas 1, 3, 6, 12 y "Otra", el mes del primer pago desde hoy y pide la cuota una vez con el valor del avance', async () => {
    await avanceHastaCuotas();

    expect(screen.getByText('Avance en efectivo')).toBeOnTheScreen();
    expect(screen.queryByText('Tarjeta de crédito')).toBeNull();
    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();
    for (const texto of ['1 cuota', '3 cuotas', '6 cuotas', '12 cuotas', 'Otra']) {
      expect(opcion(texto)).toBeOnTheScreen();
    }
    expect(opcion('1 cuota')).toBeSelected();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(cuotaPrevia).toHaveBeenCalledTimes(1);
    expect(cuotaPrevia).toHaveBeenCalledWith(VISA_ID, {
      valor: 500000,
      cuotas: 1,
      primerPago: '2026-11',
    });
  });

  it('CA-RF28-F05 con 6 cuotas y la cuota 89741,0851 ve "$ 89.741 x 6" con la nota', async () => {
    cuotaPrevia.mockImplementation(async (_id, { cuotas }) =>
      cuotas === 6 ? cuotaDe(89741.0851, '2027-05') : cuotaDe(500000, '2026-11'),
    );
    await avanceHastaCuotas();

    await elegirCuotas(6);

    expect(plano()).toContain('$ 89.741 x 6');
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
  });

  it('CA-RF28-F05 al cambiar las cuotas espera 400 ms y consulta una sola vez; al cambiar el mes también', async () => {
    await avanceHastaCuotas();

    await fireEvent.press(opcion('6 cuotas'));
    await esperar(399);
    expect(llamadas()).toBe(1);
    expect(hayCalculando()).toBe(true);
    expect(siguiente()).toBeDisabled();
    await esperar(1);
    expect(llamadas()).toBe(2);
    expect(ultimaLlamada()).toEqual([VISA_ID, { valor: 500000, cuotas: 6, primerPago: '2026-11' }]);

    await mesSiguiente();
    await esperar(399);
    expect(llamadas()).toBe(2);
    await esperar(1);
    expect(llamadas()).toBe(3);
    expect(ultimaLlamada()).toEqual([VISA_ID, { valor: 500000, cuotas: 6, primerPago: '2026-12' }]);
  });

  it('CA-RF28-F05 "Otra" pide un número de 1 a 60: con 61 avisa y no consulta; con 60 consulta', async () => {
    await avanceHastaCuotas();
    await fireEvent.press(opcion('Otra'));

    await fireEvent.changeText(campoCuotas(), '61');
    await esperar(1000);

    expect(screen.getByText(TEXTO.rangoCuotas)).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();
    expect(llamadas()).toBe(1);

    await fireEvent.changeText(campoCuotas(), '60');
    await esperar(400);

    expect(screen.queryByText(TEXTO.rangoCuotas)).toBeNull();
    expect(ultimaLlamada()).toEqual([
      VISA_ID,
      { valor: 500000, cuotas: 60, primerPago: '2026-11' },
    ]);
  });

  it('CA-RF28-F05 si la cuota estimada falla avisa y "Reintentar" consulta de nuevo; sin estimación no se avanza', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(500, 'x'));
    await avanceHastaCuotas();

    expect(screen.getByText(TEXTO.errorCuota)).toBeOnTheScreen();
    expect(siguiente()).toBeDisabled();
    await fireEvent.press(siguiente());
    expect(screen.getByText('¿Cuántas cuotas?')).toBeOnTheScreen();

    await fireEvent.press(boton('Reintentar'));

    expect(llamadas()).toBe(2);
    expect(screen.queryByText(TEXTO.errorCuota)).toBeNull();
    expect(siguiente()).toBeEnabled();
  });

  it('CA-RF28-F05 una respuesta atrasada de otras cuotas no pisa la actual', async () => {
    await avanceHastaCuotas();
    const de6 = pendiente<CuotaPrevia>();
    const de12 = pendiente<CuotaPrevia>();
    cuotaPrevia.mockReturnValueOnce(de6.promesa).mockReturnValueOnce(de12.promesa);
    await fireEvent.press(opcion('6 cuotas'));
    await esperar(400);
    await fireEvent.press(opcion('12 cuotas'));
    await esperar(400);

    await act(async () => de12.resolver(cuotaDe(50000, '2027-11')));
    await act(async () => de6.resolver(cuotaDe(99999, '2027-05')));

    expect(plano()).toContain('$ 50.000 x 12');
    expect(plano()).not.toContain('99.999');
    expect(hayEstimacion()).toBe(true);
  });

  it('CA-RF28-F05 con 1 cuota y la cuota única sin interés explica el pago único', async () => {
    cuotaPrevia.mockResolvedValue(
      cuotaDe(500000, '2026-11', { cuotaUnicaSinInteres: true, tasaEAAplicada: 0.2421 }),
    );
    await avanceHastaCuotas(OPCION.amex);

    expect(screen.getByText(TEXTO.pagoUnico)).toBeOnTheScreen();
    expect(hayEstimacion()).toBe(false);
  });
});

describe('Avance en efectivo: fecha, nota y resumen', () => {
  it('CA-RF28-F06 la fecha es la de siempre: paso 4 de 5, "Hoy" elegida, "Ayer" y "Otra fecha", "Atrás" y "Siguiente"', async () => {
    await avanceHastaCuotas();
    await hastaFecha();

    expect(screen.getByText('¿Cuándo fue?')).toBeOnTheScreen();
    expect(screen.getByText('4 de 5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Ayer' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Otra fecha' })).toBeOnTheScreen();
    expect(atras()).toBeOnTheScreen();
    expect(siguiente()).toBeOnTheScreen();
  });

  it('CA-RF28-F07 la nota opcional y el resumen: valor, tarjeta, cuotas, cuota estimada, primer y último pago, fecha, la nota del extracto y la aclaración del dinero recibido; sin categoría ni método', async () => {
    await avanceHastaElResumen();

    expect(screen.getByText('¿Quieres agregar una nota?')).toBeOnTheScreen();
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    const texto = plano();
    expect(texto).toContain('Valor $ 500.000');
    expect(texto).toContain('Tarjeta Visa Bancolombia');
    expect(texto).toContain('Cuotas 6 cuotas');
    expect(texto).toContain('Cuota estimada $ 89.741');
    expect(texto).toContain('Primer pago diciembre 2026');
    expect(texto).toContain('Último pago mayo 2027');
    expect(texto).toContain('Fecha Hoy');
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dineroRecibido)).toBeOnTheScreen();
    expect(texto).not.toMatch(/Categoría/);
    expect(texto).not.toMatch(/Método/);
  });

  it('CA-RF28-F07 la fecha del resumen es la elegida', async () => {
    await avanceHastaElResumen({ ayer: true });

    expect(plano()).toContain('Fecha Ayer');
  });
});

describe('Avance en efectivo: lenguaje y accesibilidad', () => {
  it('CA-RF28-F16 los pasos y el resumen hablan de avance, dinero recibido, tarjeta, cuotas, sin términos técnicos', async () => {
    cuotaPrevia.mockResolvedValue(cuotaDe(89741.0851, '2027-05'));
    await avanceHastaTarjetas();
    expect(plano()).not.toMatch(TECNICO);
    await fireEvent.press(boton(OPCION.visa));
    await screen.findByText('¿Cuántas cuotas?');
    await vaciar();
    expect(plano()).not.toMatch(TECNICO);
    await elegirCuotas(6);
    expect(plano()).not.toMatch(TECNICO);
    await hastaFecha();
    await hastaResumen();

    expect(plano()).not.toMatch(TECNICO);
    expect(plano()).not.toMatch(TIPO_AVANCE);
    expect(plano()).toMatch(/dinero recibido/);
    expect(plano()).toMatch(/Avance en efectivo/);
  });

  it('CA-RF28-F16 las opciones de cuotas, el campo y el selector del mes se anuncian como en la compra, y los avisos como alerta', async () => {
    cuotaPrevia.mockRejectedValueOnce(new ApiError(500, 'x'));
    await avanceHastaCuotas();

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCuota);
    expect(plano()).not.toMatch(TECNICO);
    expect(opcion('1 cuota')).toBeSelected();
    expect(opcion('3 cuotas')).not.toBeSelected();
    expect(opcion('Mes anterior')).toBeOnTheScreen();
    expect(opcion('Mes siguiente')).toBeOnTheScreen();
    await fireEvent.press(opcion('Otra'));
    expect(opcion('Otra')).toBeSelected();
    expect(screen.getByLabelText('Número de cuotas')).toBeOnTheScreen();
  });
});
