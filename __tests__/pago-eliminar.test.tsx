import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type PagoTarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  dejarHoy,
  fijarHoy,
  hayBoton,
  hayTexto,
  mostrarDetalle,
  PAGO_2,
  PAGO_3,
  PAGO_PARCIAL,
  pagosPedidos,
  plano,
  proyeccionPedida,
  SIN_PAGOS,
  servirDetalle,
  TEXTO,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import {
  conCodigo,
  desconocido,
  errorHttp,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import { eliminarPagoSimulado, registrarPagoSimulado, TEXTO_PAGO } from './ayudas/pago-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, laHoja, pendiente, RED, VER_TODO } from './ayudas/tarjetas';

// Eliminar un pago desde el detalle de la tarjeta (criterios/05-pago-de-tarjeta.md, CA-RF32-F34 a F38). El backend
// se simula en el borde del adaptador (lib/api/tarjetas) con una lista de pagos en memoria: lo que se elimina es lo
// que el detalle vuelve a mostrar. Hoy es el 19 de noviembre de 2026.
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
  registrarPagoSimulado().mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const ELIMINAR_PAGO_3 = 'Eliminar el pago de $ 100.000, 15 de noviembre de 2026';
const ELIMINAR_PAGO_2 = 'Eliminar el pago de $ 50.000, 10 de noviembre de 2026';
const DETALLE_DEL_DIALOGO =
  'Pago de tarjeta · $ 100.000 · 15 de noviembre de 2026. Esta acción no se puede deshacer.';

const dialogoAbierto = () => screen.queryByText(TEXTO_PAGO.tituloDialogo) !== null;
const hayAlerta = () => screen.queryByRole('alert') !== null;
const eliminar = () => eliminarPagoSimulado();

/** El detalle con un servidor de pagos en memoria: lo eliminado deja de venir en la lista y en las cifras. */
async function conPagos(inicial: PagoTarjeta[] = [PAGO_3, PAGO_2]) {
  const servidor = { items: [...inicial] };
  eliminar().mockImplementation(async (_tarjetaId, pagoId) => {
    servidor.items = servidor.items.filter((p) => p.id !== pagoId);
  });
  await mostrarDetalle({
    pagos: () => servidor.items.map((p) => ({ ...p })),
    proyeccion: (mes) => (servidor.items.length ? { ...PAGO_PARCIAL, mes } : { ...SIN_PAGOS, mes }),
  });
  return servidor;
}
async function abrirDialogo(nombre = ELIMINAR_PAGO_3) {
  await fireEvent.press(boton(nombre));
  await screen.findByText(TEXTO_PAGO.tituloDialogo);
}

describe('Eliminar un pago: la confirmación', () => {
  it('CA-RF32-F34 cada pago tiene su botón de eliminar y al tocarlo se pide confirmación, sin llamar todavía a eliminarPago', async () => {
    await conPagos();
    expect(boton(ELIMINAR_PAGO_3)).toBeOnTheScreen();
    expect(boton(ELIMINAR_PAGO_2)).toBeOnTheScreen();

    await fireEvent.press(boton(ELIMINAR_PAGO_3));

    expect(await screen.findByText('¿Eliminar este pago?')).toBeOnTheScreen();
    expect(screen.getByText(DETALLE_DEL_DIALOGO)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
    expect(eliminar()).not.toHaveBeenCalled();
  });

  it('CA-RF32-F34 "Cancelar" cierra el diálogo sin llamar a nada y el pago sigue ahí', async () => {
    await conPagos();
    await abrirDialogo();

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).not.toHaveBeenCalled();
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    expect(boton(ELIMINAR_PAGO_3)).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de este mes')).toBeOnTheScreen();
  });

  it('CA-RF32-F35 "Eliminar" llama a eliminarPago una sola vez, cierra el diálogo y vuelve a pedir la proyección y los pagos del mes', async () => {
    await conPagos();
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).toHaveBeenCalledTimes(1);
    expect(eliminar()).toHaveBeenCalledWith(VISA_ID, 'pago-3');
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(2));
    expect(proyeccionPedida()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
    expect(pagosPedidos()).toHaveBeenLastCalledWith(VISA_ID, '2026-11');
  });

  it('CA-RF32-F35 con lo que responden, la fila ya no está y se ven las demás, sin aviso de "eliminado"', async () => {
    await conPagos();
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false));
    expect(boton(ELIMINAR_PAGO_2)).toBeOnTheScreen();
    expect(screen.getByText('Tus pagos de este mes')).toBeOnTheScreen();
    expect(hayAlerta()).toBe(false);
    expect(plano()).not.toMatch(/eliminad/i);
  });

  it('CA-RF32-F35 si era el último pago del mes, la sección desaparece y lo pagado y la diferencia muestran las cifras nuevas', async () => {
    await conPagos([PAGO_3]);
    expect(screen.getByLabelText('Este mes has pagado, $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 246.270')).toBeOnTheScreen();
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(screen.queryByText('Tus pagos de este mes')).toBeNull());
    expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false);
    expect(await screen.findByLabelText('Este mes has pagado, $ 0')).toBeOnTheScreen();
    expect(screen.getByText('Te falta pagar $ 346.270')).toBeOnTheScreen();
    expect(screen.queryByText('Te falta pagar $ 246.270')).toBeNull();
    expect(hayAlerta()).toBe(false);
  });

  it('CA-RF32-F36 mientras elimina, el botón muestra un indicador y no se puede tocar; dos toques llaman una sola vez', async () => {
    await conPagos();
    await abrirDialogo();
    const respuesta = pendiente<void>();
    eliminar().mockReturnValueOnce(respuesta.promesa);
    const confirmar = boton('Eliminar');

    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    expect(laHoja().queryByText('Eliminar')).toBeNull();
    expect(confirmar).toBeDisabled();
    expect(eliminar()).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver());
    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).toHaveBeenCalledTimes(1);
  });

  it('CA-RF32-F37 si el pago ya no existe (404) se da por eliminado: el diálogo se cierra, se vuelve a pedir todo y no hay aviso de error', async () => {
    const servidor = await conPagos();
    eliminar().mockImplementation(async () => {
      // Ya lo habían eliminado desde otro dispositivo
      servidor.items = servidor.items.filter((p) => p.id !== 'pago-3');
      throw new ApiError(404, 'Pago no encontrado');
    });
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    await waitFor(() => expect(proyeccionPedida()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(pagosPedidos()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false));
    expect(hayAlerta()).toBe(false);
    expect(hayTexto('Pago no encontrado')).toBe(false);
    expect(hayTexto(TEXTO_PAGO.errorEliminar)).toBe(false);
    expect(hayTexto(TEXTO.yaNoExiste)).toBe(false);
  });
});

describe('Eliminar un pago: si falla', () => {
  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['con un error del servidor (500)', new ApiError(500, 'x'), TEXTO_PAGO.errorEliminar],
    ['con un error de datos (400)', new ApiError(400, 'x'), TEXTO_PAGO.errorEliminar],
  ])(
    'CA-RF32-F38 si falla %s avisa dentro del diálogo, que sigue abierto, y el pago sigue en la lista',
    async (_causa, error, aviso) => {
      await conPagos();
      eliminar().mockRejectedValueOnce(error);
      await abrirDialogo();

      await fireEvent.press(boton('Eliminar'));

      expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
      expect(dialogoAbierto()).toBe(true);
      expect(screen.getByText(aviso)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: ELIMINAR_PAGO_3, ...VER_TODO })).toBeOnTheScreen();
      expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
      expect(pagosPedidos()).toHaveBeenCalledTimes(1);
    },
  );

  it('CA-RF32-F38 después de un fallo puede volver a tocar "Eliminar" y esta vez se elimina', async () => {
    await conPagos();
    eliminar().mockRejectedValueOnce(new ApiError(500, 'x'));
    await abrirDialogo();
    await fireEvent.press(boton('Eliminar'));
    await screen.findByRole('alert');

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false));
  });

  it('CA-RF32-F38 ante un 401 el diálogo no muestra un aviso de error propio', async () => {
    await conPagos();
    eliminar().mockRejectedValueOnce(new ApiError(401, 'x'));
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));
    await waitFor(() => expect(eliminar()).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(hayAlerta()).toBe(false);
    expect(hayTexto(TEXTO_PAGO.errorEliminar)).toBe(false);
    expect(hayTexto(RED)).toBe(false);
  });
});

// criterios/08-codigos-de-error.md
describe('Eliminar un pago: códigos de error', () => {
  it('CA-RNF04-11 con PAGO_NO_ENCONTRADO se da por eliminado, sin aviso', async () => {
    const servidor = await conPagos();
    eliminar().mockImplementation(async () => {
      servidor.items = servidor.items.filter((p) => p.id !== 'pago-3');
      throw conCodigo(404, 'PAGO_NO_ENCONTRADO');
    });
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    await waitFor(() => expect(hayBoton(ELIMINAR_PAGO_3)).toBe(false));
    expect(hayAlerta()).toBe(false);
  });

  it.each([
    ['CA-RNF04-15', 'una dirección que no existe', rutaNoEncontrada(), TEXTO_PAGO.errorEliminar],
    ['CA-RNF04-17', 'ERROR_HTTP', errorHttp(), TEXTO_PAGO.errorEliminar],
    ['CA-RNF04-18', 'un caso sin texto propio', desconocido(), MENSAJE_Y_ACCION],
  ])('%s con %s avisa dentro del diálogo y el pago sigue', async (_id, _caso, fallo, aviso) => {
    await conPagos();
    eliminar().mockRejectedValueOnce(fallo);
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
    expect(dialogoAbierto()).toBe(true);
    expect(screen.getByRole('button', { name: ELIMINAR_PAGO_3, ...VER_TODO })).toBeOnTheScreen();
  });
});
