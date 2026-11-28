import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type PagoTarjeta,
  type ProyeccionTarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  dejarHoy,
  fijarHoy,
  hayCargando,
  mostrarDetalle,
  PAGO_3,
  PAGO_PARCIAL,
  pagosPedidos,
  plano,
  proyeccionPedida,
  servirDetalle,
  tarjetaPedida,
  TEXTO,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import {
  CON_TEXTO_GENERAL,
  conCodigo,
  desconocido,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import {
  abrirHoja,
  botonGuardarPago,
  campoNota,
  campoValor,
  clavesDePago,
  cuerposDePago,
  eliminarPagoSimulado,
  escribirNota,
  escribirValor,
  esperarHojaCerrada,
  guardarYVerConfirmacion,
  hojaAbierta,
  mostrarHojaLlena,
  pagoRegistradoDe,
  registrarPagoSimulado,
  TEXTO_PAGO,
} from './ayudas/pago-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, laHoja, pendiente, RED, UUID, VER_TODO } from './ayudas/tarjetas';

// Registrar un pago: lo que se ve al guardar, los errores, la clave de idempotencia y la sesión vencida
// (criterios/05-pago-de-tarjeta.md, CA-RF32-F13 a F24). El backend se simula en el borde del adaptador
// (lib/api/tarjetas). Hoy es el 19 de noviembre de 2026.
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
  jest.mocked(listarTarjetas).mockReset();
  jest.mocked(crearTarjeta).mockReset();
  jest.mocked(actualizarTarjeta).mockReset();
  jest.mocked(eliminarTarjeta).mockReset();
  eliminarPagoSimulado().mockReset();
  registrarPagoSimulado().mockReset().mockResolvedValue(pagoRegistradoDe());
  servirDetalle();
});
afterEach(() => dejarHoy());

const tocar = (nombre: string) => fireEvent.press(boton(nombre));
const hayAlerta = () => screen.queryByRole('alert') !== null;
const hayTexto = (texto: string | RegExp) => screen.queryByText(texto) !== null;
/** Lo que se ve de la hoja, sin lo que queda detrás de ella. */
const enLaHoja = (texto: string | RegExp) => laHoja().queryByText(texto) !== null;
const volverDeLaConfirmacion = () => laHoja().getByRole('button', { name: 'Volver' });

/** El detalle de "Visa Bancolombia" con cifras y la hoja llena con $ 100.000 de hoy, por transferencia. */
async function hojaConCifras(valor = '100000') {
  await mostrarDetalle();
  await abrirHoja();
  await escribirValor(valor);
}

describe('Registrar un pago: la confirmación', () => {
  it('CA-RF32-F13 al guardar ve "¡Listo!", "Registramos tu pago de $ 100.000 a Visa Bancolombia." y el botón "Listo", sin el formulario', async () => {
    await hojaConCifras();

    await guardarYVerConfirmacion();

    expect(
      screen.getByText('Registramos tu pago de $ 100.000 a Visa Bancolombia.'),
    ).toBeOnTheScreen();
    expect(boton('Listo')).toBeOnTheScreen();
    expect(screen.queryByText('Guardar pago')).toBeNull();
    expect(screen.queryByLabelText('Monto en pesos')).toBeNull();
    expect(screen.queryByLabelText('Nota')).toBeNull();
    expect(screen.queryByText('Valor del pago')).toBeNull();
  });

  it('CA-RF32-F13 el valor de la confirmación sale de la respuesta del guardado, no de lo escrito', async () => {
    registrarPagoSimulado().mockResolvedValue(pagoRegistradoDe({ valor: 120000 }));
    await hojaConCifras('100000');

    await guardarYVerConfirmacion();

    expect(
      screen.getByText('Registramos tu pago de $ 120.000 a Visa Bancolombia.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/\$ 100\.000 a Visa/)).toBeNull();
  });

  it('CA-RF32-F13 mientras se ve la confirmación no se llama otra vez a registrarPago ni se vuelve a pedir nada', async () => {
    await hojaConCifras();

    await guardarYVerConfirmacion();
    await act(async () => {});

    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1);
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(eliminarPagoSimulado()).not.toHaveBeenCalled();
  });

  it('CA-RF32-F14 muestra la comparación del mes del pago tal como llega, con el mes por su nombre', async () => {
    await hojaConCifras();

    await guardarYVerConfirmacion();

    expect(screen.getByText('Estimado de noviembre 2026: $ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('Pagado en noviembre 2026: $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 246.270')).toBeOnTheScreen();
  });

  it('CA-RF32-F14 si el pago es de otro mes, la comparación nombra ese mes y nunca dice "este mes"', async () => {
    registrarPagoSimulado().mockResolvedValue(
      pagoRegistradoDe(
        { fecha: '2026-10-28' },
        { mes: '2026-10', estimado: 200000, pagado: 150000, diferencia: -50000 },
      ),
    );
    await hojaConCifras();

    await guardarYVerConfirmacion();

    expect(screen.getByText('Estimado de octubre 2026: $ 200.000')).toBeOnTheScreen();
    expect(screen.getByText('Pagado en octubre 2026: $ 150.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 50.000')).toBeOnTheScreen();
    expect(enLaHoja(/este mes/i)).toBe(false);
  });

  it.each([
    ['negativa', 'Te falta pagar $ 246.270', -246270.05016469],
    ['positiva', 'Pagaste de más $ 53.730', 53729.94983531],
    ['cero', 'Pagaste justo lo estimado', 0],
  ])(
    'CA-RF32-F15 una diferencia %s se dice con palabras cotidianas: "%s"',
    async (_signo, texto, diferencia) => {
      registrarPagoSimulado().mockResolvedValue(pagoRegistradoDe({}, { diferencia }));
      await hojaConCifras();

      await guardarYVerConfirmacion();

      expect(screen.getByText(texto)).toBeOnTheScreen();
      const visto = plano();
      expect(visto).not.toMatch(/−|diferencia|NaN|undefined/i);
      expect(visto).not.toMatch(/\$ [\d.]*,/);
    },
  );

  it.each([
    [-0.05016469, 'Pagaste justo lo estimado'],
    [0.4, 'Pagaste justo lo estimado'],
    [-0.6, 'Te falta pagar $ 1'],
  ])(
    'CA-RF32-F16 una diferencia de %s se lee como "%s": menos de medio peso cuenta como "justo"',
    async (diferencia, texto) => {
      registrarPagoSimulado().mockResolvedValue(pagoRegistradoDe({}, { diferencia }));
      await hojaConCifras();

      await guardarYVerConfirmacion();

      expect(screen.getByText(texto)).toBeOnTheScreen();
      expect(screen.queryByText('Te falta pagar $ 0')).toBeNull();
      expect(screen.queryByText('Pagaste de más $ 0')).toBeNull();
    },
  );

  it('CA-RF32-F18 la confirmación muestra lo que responde el backend aunque las cifras no cuadren: "Pagaste de más $ 5"', async () => {
    registrarPagoSimulado().mockResolvedValue(
      pagoRegistradoDe({}, { estimado: 346270, pagado: 100000, diferencia: 5 }),
    );
    await hojaConCifras();

    await guardarYVerConfirmacion();

    expect(screen.getByText('Pagaste de más $ 5')).toBeOnTheScreen();
    expect(screen.getByText('Estimado de noviembre 2026: $ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('Pagado en noviembre 2026: $ 100.000')).toBeOnTheScreen();
    expect(screen.queryByText('Te falta pagar $ 246.270')).toBeNull();
  });
});

describe('Registrar un pago: al cerrar la confirmación', () => {
  it('CA-RF32-F17 "Listo" cierra la hoja y vuelve a pedir la proyección y los pagos del mes que se veía, una vez cada una', async () => {
    await hojaConCifras();
    await guardarYVerConfirmacion();

    await tocar('Listo');

    await esperarHojaCerrada();
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(2));
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    await act(async () => {});
    expect(proyeccionPedida()).toHaveBeenCalledTimes(2);
    expect(pagosPedidos()).toHaveBeenCalledTimes(2);
    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1);
  });

  it('CA-RF32-F17 "Volver" de la confirmación hace lo mismo que "Listo"', async () => {
    await hojaConCifras();
    await guardarYVerConfirmacion();

    await fireEvent.press(volverDeLaConfirmacion());

    await esperarHojaCerrada();
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(2));
    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1);
  });

  it('CA-RF32-F17 cuando llegan las respuestas, el detalle muestra las cifras y la lista nuevas', async () => {
    await hojaConCifras();
    await guardarYVerConfirmacion();
    proyeccionPedida().mockImplementation(async (_id, mes) => ({ ...PAGO_PARCIAL, mes }));
    pagosPedidos().mockResolvedValue([{ ...PAGO_3 }]);

    await tocar('Listo');

    expect(await screen.findByLabelText('Este mes has pagado, $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 246.270')).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de este mes')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Eliminar el pago de $ 100.000, 15 de noviembre de 2026',
      }),
    ).toBeOnTheScreen();
  });

  it('CA-RF32-F17 el selector sigue en el mes que se veía aunque el pago sea de otro mes', async () => {
    registrarPagoSimulado().mockResolvedValue(
      pagoRegistradoDe({ fecha: '2026-10-28' }, { mes: '2026-10' }),
    );
    await hojaConCifras();
    await guardarYVerConfirmacion();

    await tocar('Listo');

    await esperarHojaCerrada();
    expect(screen.getByText('noviembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('octubre 2026')).toBeNull();
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
  });

  it('CA-RF32-F17 con el detalle en otro mes, pide ese mes y el selector no cambia', async () => {
    await mostrarDetalle();
    await tocar('Mes siguiente');
    await screen.findByText('Pagas en diciembre 2026');
    await abrirHoja();
    await escribirValor('100000');
    await guardarYVerConfirmacion();

    await tocar('Listo');

    await esperarHojaCerrada();
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(3));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-12');
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-12');
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
  });

  it('CA-RF32-F17 mientras llegan las respuestas se siguen viendo las cifras que ya estaban, sin indicador', async () => {
    await hojaConCifras();
    await guardarYVerConfirmacion();
    const proyeccion = pendiente<ProyeccionTarjeta>();
    const pagos = pendiente<PagoTarjeta[]>();
    proyeccionPedida().mockReturnValueOnce(proyeccion.promesa);
    pagosPedidos().mockReturnValueOnce(pagos.promesa);

    await tocar('Listo');

    await esperarHojaCerrada();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('$ 1.766.529')).toBeOnTheScreen();
    expect(hayCargando()).toBe(false);

    await act(async () => {
      proyeccion.resolver({ ...PAGO_PARCIAL });
      pagos.resolver([{ ...PAGO_3 }]);
    });
    expect(await screen.findByLabelText('Este mes has pagado, $ 100.000')).toBeOnTheScreen();
  });
});

describe('Registrar un pago: errores al guardar', () => {
  it('CA-RF32-F19 sin conexión avisa dentro de la hoja como alerta, con lo escrito intacto y "Guardar pago" disponible', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new NetworkError());
    await hojaConCifras();
    await escribirNota('Cuota');
    await tocar('Efectivo');

    await fireEvent.press(botonGuardarPago());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(hojaAbierta()).toBe(true);
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
    expect(campoNota()).toHaveDisplayValue('Cuota');
    expect(boton('Efectivo')).toBeSelected();
    expect(botonGuardarPago()).toBeEnabled();
  });

  it('CA-RF32-F19 al volver a tocarlo sin cambiar nada, lleva la misma clave y el mismo cuerpo, y el aviso desaparece al lograr guardar', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new NetworkError());
    await hojaConCifras();
    await fireEvent.press(botonGuardarPago());
    await screen.findByText(RED);

    await fireEvent.press(botonGuardarPago());

    await screen.findByText('¡Listo!');
    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2);
    const [primera, segunda] = clavesDePago();
    expect(primera).toMatch(UUID);
    expect(segunda).toBe(primera);
    expect(cuerposDePago()[1]).toEqual(cuerposDePago()[0]);
    expect(hayTexto(RED)).toBe(false);
    expect(hayAlerta()).toBe(false);
  });

  it.each([400, 422, 500])(
    'CA-RF32-F20 un %s avisa "No pudimos guardar tu pago…" sin términos técnicos, con la hoja abierta y lo escrito intacto',
    async (status) => {
      registrarPagoSimulado().mockRejectedValueOnce(new ApiError(status, 'mensaje del backend'));
      await hojaConCifras();
      await escribirNota('Cuota');

      await fireEvent.press(botonGuardarPago());

      expect(await screen.findByText(TEXTO_PAGO.errorGuardar)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO_PAGO.errorGuardar);
      expect(screen.queryByText(/mensaje del backend/)).toBeNull();
      expect(plano()).not.toMatch(/\b(400|422|500)\b|idempoten|payload/i);
      expect(hojaAbierta()).toBe(true);
      expect(campoValor()).toHaveDisplayValue('$ 100.000');
      expect(campoNota()).toHaveDisplayValue('Cuota');
    },
  );

  it.each([400, 422, 500])(
    'CA-RF32-F20 tras un %s, volver a tocar "Guardar pago" sin cambiar nada lleva la misma clave',
    async (status) => {
      registrarPagoSimulado().mockRejectedValueOnce(new ApiError(status, 'x'));
      await hojaConCifras();
      await fireEvent.press(botonGuardarPago());
      await screen.findByText(TEXTO_PAGO.errorGuardar);

      await fireEvent.press(botonGuardarPago());

      await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2));
      expect(clavesDePago()[1]).toBe(clavesDePago()[0]);
    },
  );

  it('CA-RF32-F21 si todavía se está procesando (409) avisa que espere, no que los datos son incorrectos, y reintenta con la misma clave', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new ApiError(409, 'x'));
    await hojaConCifras();

    await fireEvent.press(botonGuardarPago());

    expect(await screen.findByText(TEXTO_PAGO.procesando)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_PAGO.errorGuardar)).toBeNull();
    expect(botonGuardarPago()).toBeEnabled();

    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2));
    expect(clavesDePago()[1]).toBe(clavesDePago()[0]);
  });

  it('CA-RF32-F22 si la tarjeta ya no existe (404) avisa "Esta tarjeta ya no existe." dentro de la hoja, que sigue abierta con lo escrito', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new ApiError(404, 'Tarjeta no encontrada'));
    await hojaConCifras();
    await escribirNota('Cuota');

    await fireEvent.press(botonGuardarPago());

    expect(await screen.findByText(TEXTO.yaNoExiste, VER_TODO)).toBeOnTheScreen();
    expect(enLaHoja(TEXTO.yaNoExiste)).toBe(true);
    expect(screen.queryByText('Tarjeta no encontrada', VER_TODO)).toBeNull();
    expect(hojaAbierta()).toBe(true);
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
    expect(campoNota()).toHaveDisplayValue('Cuota');
  });

  it('CA-RF32-F22 al cerrar la hoja con "Volver", el detalle vuelve a pedir sus datos y muestra "Esta tarjeta ya no existe."', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new ApiError(404, 'Tarjeta no encontrada'));
    await hojaConCifras();
    proyeccionPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));
    pagosPedidos().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));
    tarjetaPedida().mockRejectedValue(new ApiError(404, 'Tarjeta no encontrada'));
    await fireEvent.press(botonGuardarPago());
    // Si el detalle ya se actualizó por detrás, el aviso también está allí: basta con que se vea
    await screen.findAllByText(TEXTO.yaNoExiste, VER_TODO);

    await fireEvent.press(laHoja().getByRole('button', { name: 'Volver' }));

    await esperarHojaCerrada();
    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(proyeccionPedida().mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();
  });
});

describe('Registrar un pago: la clave de idempotencia y la sesión', () => {
  it.each([
    ['el valor', () => escribirValor('120000'), { valor: 120000 }],
    ['la fecha', () => tocar('Ayer'), { fecha: '2026-11-18' }],
    ['el método', () => tocar('Efectivo'), { metodoPago: 'EFECTIVO' }],
    ['la nota', () => escribirNota('Cuota'), { descripcion: 'Cuota' }],
  ])(
    'CA-RF32-F23 tras un fallo, cambiar %s es una acción nueva: otra clave y el cuerpo nuevo',
    async (_campo, cambiar, cambio) => {
      registrarPagoSimulado().mockRejectedValueOnce(new ApiError(500, 'x'));
      await hojaConCifras();
      await fireEvent.press(botonGuardarPago());
      await screen.findByText(TEXTO_PAGO.errorGuardar);

      await cambiar();
      await fireEvent.press(botonGuardarPago());

      await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2));
      const [primera, segunda] = clavesDePago();
      expect(segunda).toMatch(UUID);
      expect(segunda).not.toBe(primera);
      expect(cuerposDePago()[1]).toEqual({ ...cuerposDePago()[0], ...cambio });
    },
  );

  it('CA-RF32-F23 un pago nuevo después de guardar lleva otra clave, aunque los datos sean idénticos', async () => {
    await hojaConCifras();
    await guardarYVerConfirmacion();
    await tocar('Listo');
    await esperarHojaCerrada();

    await abrirHoja();
    await escribirValor('100000');
    await guardarYVerConfirmacion();

    expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2);
    const [primera, segunda] = clavesDePago();
    expect(segunda).toMatch(UUID);
    expect(segunda).not.toBe(primera);
    expect(cuerposDePago()[1]).toEqual(cuerposDePago()[0]);
  });

  it('CA-RF32-F23 cerrar la hoja tras un fallo y abrirla de nuevo con los mismos datos lleva otra clave', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new ApiError(500, 'x'));
    await mostrarHojaLlena();
    await fireEvent.press(botonGuardarPago());
    await screen.findByText(TEXTO_PAGO.errorGuardar);
    await fireEvent.press(laHoja().getByRole('button', { name: 'Volver' }));
    await esperarHojaCerrada();

    await abrirHoja();
    await escribirValor('100000');
    await fireEvent.press(botonGuardarPago());

    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2));
    const [primera, segunda] = clavesDePago();
    expect(segunda).toMatch(UUID);
    expect(segunda).not.toBe(primera);
    expect(cuerposDePago()[1]).toEqual(cuerposDePago()[0]);
  });

  it('CA-RF32-F24 ante un 401 la hoja no muestra un aviso de error propio', async () => {
    registrarPagoSimulado().mockRejectedValueOnce(new ApiError(401, 'x'));
    await hojaConCifras();

    await fireEvent.press(botonGuardarPago());
    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(hayAlerta()).toBe(false);
    expect(hayTexto(TEXTO_PAGO.errorGuardar)).toBe(false);
    expect(hayTexto(TEXTO_PAGO.procesando)).toBe(false);
    expect(hayTexto(RED)).toBe(false);
    expect(hayTexto(TEXTO.yaNoExiste)).toBe(false);
  });
});

// criterios/08-codigos-de-error.md
describe('Registrar un pago: códigos de error', () => {
  async function fallar(fallo: Error) {
    registrarPagoSimulado().mockRejectedValueOnce(fallo);
    await hojaConCifras();
    await fireEvent.press(botonGuardarPago());
    return screen.findByRole('alert');
  }
  async function reintentar() {
    await fireEvent.press(botonGuardarPago());
    await waitFor(() => expect(registrarPagoSimulado()).toHaveBeenCalledTimes(2));
  }

  it('CA-RNF04-07 si todavía se está guardando pide esperar y reintenta con la misma clave', async () => {
    const alerta = await fallar(conCodigo(409, 'IDEMPOTENCIA_EN_PROCESO'));

    expect(alerta).toHaveTextContent(TEXTO_PAGO.procesando);
    await reintentar();
    expect(clavesDePago()[1]).toBe(clavesDePago()[0]);
  });

  it('CA-RNF04-08 si la clave ya se usó muestra el texto general y el siguiente intento lleva otra clave', async () => {
    const alerta = await fallar(conCodigo(422, 'IDEMPOTENCIA_CLAVE_REUTILIZADA'));

    expect(alerta).toHaveTextContent(TEXTO_PAGO.errorGuardar);
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
    await reintentar();
    expect(clavesDePago()[1]).toMatch(UUID);
    expect(clavesDePago()[1]).not.toBe(clavesDePago()[0]);
  });

  it('CA-RNF04-11 con TARJETA_NO_ENCONTRADA dice que la tarjeta ya no existe', async () => {
    const alerta = await fallar(conCodigo(404, 'TARJETA_NO_ENCONTRADA'));

    expect(alerta).toHaveTextContent(TEXTO.yaNoExiste);
  });

  it('CA-RNF04-13 con un 404 sin code dice que la tarjeta ya no existe, diga lo que diga el message', async () => {
    const alerta = await fallar(new ApiError(404, 'Not Found'));

    expect(alerta).toHaveTextContent(TEXTO.yaNoExiste);
  });

  it('CA-RNF04-15 una dirección que no existe muestra el texto general', async () => {
    const alerta = await fallar(rutaNoEncontrada());

    expect(alerta).toHaveTextContent(TEXTO_PAGO.errorGuardar);
    expect(screen.queryByText(TEXTO.yaNoExiste, VER_TODO)).toBeNull();
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
  });

  it.each(CON_TEXTO_GENERAL)(
    '%s con %s muestra el texto general, sin lo que manda el servidor',
    async (_id, _code, fallo) => {
      const alerta = await fallar(fallo);

      expect(alerta).toHaveTextContent(TEXTO_PAGO.errorGuardar);
      expect(screen.queryByText(fallo.message, VER_TODO)).toBeNull();
    },
  );

  it('CA-RNF04-18 con un caso sin texto propio muestra el message y el action y deja reintentar', async () => {
    const alerta = await fallar(desconocido());

    expect(alerta).toHaveTextContent(MENSAJE_Y_ACCION);
    expect(campoValor()).toHaveDisplayValue('$ 100.000');
    await reintentar();
  });
});
