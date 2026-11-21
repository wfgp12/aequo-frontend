import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AMEX, crearServidorDeTarjetas } from './ayudas/datos-tarjetas';
import {
  dejarHoy,
  fijarHoy,
  hayCargando,
  hayTexto,
  mostrarDetalle,
  proyeccionPedida,
  servirDetalle,
  tarjetaPedida,
  TEXTO,
  VISA,
  VISA_ID,
} from './ayudas/detalle-tarjeta';
import { reiniciarRouter, router } from './ayudas/router-simulado';
import { boton, interruptor, RED, VER_TODO, volverDeLaHoja } from './ayudas/tarjetas';

// Detalle de la tarjeta: lo que se hace desde él, "Editar tarjeta" (la misma hoja de 5.1.3), eliminar y "Ver
// cargos fijos" (criterios/05-detalle-de-tarjeta.md, CA-RF30-F24 a F27). El backend se simula en el borde del
// adaptador. Hoy es el 19 de noviembre de 2026.
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

const actualizar = jest.mocked(actualizarTarjeta);
const eliminar = jest.mocked(eliminarTarjeta);

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  jest.mocked(listarTarjetas).mockReset();
  jest.mocked(crearTarjeta).mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const campoAlias = () => screen.getByLabelText('Alias');
const campoTasa = () => screen.getByLabelText('Tasa de interés E.A.');
const CUOTA = 'Compras a 1 cuota sin intereses';
const hojaAbierta = () => screen.queryByLabelText('Alias', VER_TODO) !== null;
const dialogoAbierto = () => screen.queryByText('¿Eliminar esta tarjeta?') !== null;

/** El detalle de "Visa Bancolombia" con un servidor en memoria: lo que se guarda o elimina es lo que se vuelve a pedir. */
async function conServidor() {
  const servidor = crearServidorDeTarjetas([VISA, AMEX]);
  actualizar.mockImplementation(async (id, cambios) => servidor.actualizar(id, cambios));
  eliminar.mockImplementation(async (id) => servidor.eliminar(id));
  await mostrarDetalle({ servidor });
  return servidor;
}
async function abrirHoja() {
  await fireEvent.press(boton('Editar tarjeta'));
  await screen.findByText('Guardar tarjeta');
}
async function abrirDialogo() {
  await abrirHoja();
  await fireEvent.press(boton('Eliminar tarjeta'));
  await screen.findByText('¿Eliminar esta tarjeta?');
}

describe('Detalle de la tarjeta: "Editar tarjeta"', () => {
  it('CA-RF30-F24 abre la hoja con los datos de la tarjeta, sus botones y la nota de la tasa, sin llamar al backend', async () => {
    await mostrarDetalle();

    await fireEvent.press(boton('Editar tarjeta'));

    expect(await screen.findByText('Guardar tarjeta')).toBeOnTheScreen();
    // El título de la hoja y el botón del detalle dicen igual
    expect(screen.getAllByText('Editar tarjeta')).toHaveLength(2);
    expect(campoAlias()).toHaveDisplayValue('Visa Bancolombia');
    expect(campoTasa()).toHaveDisplayValue('29,21');
    expect(interruptor(CUOTA)).toBeChecked();
    expect(boton('Guardar tarjeta')).toBeOnTheScreen();
    expect(boton('Cargos fijos')).toBeOnTheScreen();
    expect(boton('Eliminar tarjeta')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Si cambias la tasa, aplica solo a las compras nuevas. Las anteriores conservan la que tenían.',
      ),
    ).toBeOnTheScreen();
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF30-F24 con otra tarjeta (sin cuota única) muestra los datos de esa tarjeta', async () => {
    const servidor = crearServidorDeTarjetas([VISA, AMEX]);
    await mostrarDetalle({ servidor, params: { id: AMEX.id, nombre: 'Amex' } });

    await abrirHoja();

    expect(campoAlias()).toHaveDisplayValue('Amex');
    expect(campoTasa()).toHaveDisplayValue('24,21');
    expect(interruptor(CUOTA)).not.toBeChecked();
  });

  it('CA-RF30-F24 "Volver" de la hoja la cierra sin guardar y deja el detalle como estaba', async () => {
    await mostrarDetalle();
    await abrirHoja();
    await fireEvent.changeText(campoAlias(), 'Cambio sin guardar');

    await fireEvent.press(volverDeLaHoja('Editar tarjeta'));

    await waitFor(() => expect(hojaAbierta()).toBe(false));
    expect(actualizar).not.toHaveBeenCalled();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
  });

  it('CA-RF30-F24 lo escrito y no guardado se descarta: al volver a abrir la hoja se ven los datos de la tarjeta', async () => {
    await mostrarDetalle();
    await abrirHoja();
    await fireEvent.changeText(campoAlias(), 'Cambio sin guardar');
    await fireEvent.press(volverDeLaHoja('Editar tarjeta'));
    await waitFor(() => expect(hojaAbierta()).toBe(false));

    await abrirHoja();

    expect(campoAlias()).toHaveDisplayValue('Visa Bancolombia');
  });

  it('CA-RF30-F25 al guardar el alias y la tasa nuevos, la hoja se cierra, se vuelve a pedir la tarjeta y el detalle muestra el título y la tasa nuevos', async () => {
    await conServidor();
    await abrirHoja();
    await fireEvent.changeText(campoAlias(), 'Visa Oro');
    await fireEvent.changeText(campoTasa(), '31,5');

    await fireEvent.press(boton('Guardar tarjeta'));

    await waitFor(() => expect(hojaAbierta()).toBe(false));
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, { nombre: 'Visa Oro', tasaEA: 0.315 });
    await waitFor(() => expect(tarjetaPedida()).toHaveBeenCalledTimes(2));
    expect(tarjetaPedida()).toHaveBeenLastCalledWith(VISA_ID);
    expect(await screen.findByText('Visa Oro')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 31,5 % E.A.')).toBeOnTheScreen();
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(screen.queryByText('Tasa 29,21 % E.A.')).toBeNull();
  });

  it('CA-RF30-F25 al guardar solo se vuelve a pedir la tarjeta: los pagos del mes no cambian', async () => {
    await conServidor();
    await abrirHoja();
    await fireEvent.changeText(campoAlias(), 'Visa Oro');

    await fireEvent.press(boton('Guardar tarjeta'));

    await waitFor(() => expect(tarjetaPedida()).toHaveBeenCalledTimes(2));
    await screen.findByText('Visa Oro');
    await act(async () => {});
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
  });

  it('CA-RF30-F25 al volver a abrir "Editar tarjeta" la hoja muestra los datos guardados', async () => {
    await conServidor();
    await abrirHoja();
    await fireEvent.changeText(campoAlias(), 'Visa Oro');
    await fireEvent.changeText(campoTasa(), '31,5');
    await fireEvent.press(boton('Guardar tarjeta'));
    await screen.findByText('Visa Oro');
    await waitFor(() => expect(hojaAbierta()).toBe(false));

    await abrirHoja();

    expect(campoAlias()).toHaveDisplayValue('Visa Oro');
    expect(campoTasa()).toHaveDisplayValue('31,5');
  });
});

describe('Detalle de la tarjeta: eliminar desde el detalle', () => {
  it.each([
    ['204', async () => undefined],
    [
      '404 (ya estaba eliminada)',
      async () => {
        throw new ApiError(404, 'Tarjeta no encontrada');
      },
    ],
  ])(
    'CA-RF30-F26 si el backend responde %s, cierra diálogo y hoja y regresa a "Mis tarjetas" sin volver a pedir nada ni avisar',
    async (_respuesta, responder) => {
      await conServidor();
      eliminar.mockImplementation(responder);
      await abrirDialogo();

      await fireEvent.press(boton('Eliminar'));

      await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(dialogoAbierto()).toBe(false));
      await waitFor(() => expect(hojaAbierta()).toBe(false));
      await act(async () => {});
      expect(eliminar).toHaveBeenCalledTimes(1);
      expect(eliminar).toHaveBeenCalledWith(VISA_ID);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
      expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
      expect(hayTexto(TEXTO.yaNoExiste)).toBe(false);
      expect(hayTexto(TEXTO.errorCarga)).toBe(false);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(hayCargando()).toBe(false);
    },
  );

  it.each([
    ['con pagos registrados (409)', new ApiError(409, 'x'), /ya tiene compras o pagos registrados/],
    ['sin conexión', new NetworkError(), new RegExp(RED)],
    ['con un error del servidor (500)', new ApiError(500, 'x'), /No pudimos eliminar tu tarjeta/],
  ])(
    'CA-RF30-F26 si falla %s, el aviso se ve dentro del diálogo, que sigue abierto, y no se regresa',
    async (_caso, error, aviso) => {
      await conServidor();
      eliminar.mockRejectedValueOnce(error);
      await abrirDialogo();

      await fireEvent.press(boton('Eliminar'));

      expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
      expect(dialogoAbierto()).toBe(true);
      expect(router.back).not.toHaveBeenCalled();
      expect(screen.queryByText(TEXTO.yaNoExiste, VER_TODO)).toBeNull();
      expect(screen.getByText('Visa Bancolombia', VER_TODO)).toBeOnTheScreen();
    },
  );
});

describe('Detalle de la tarjeta: "Ver cargos fijos"', () => {
  it('CA-RF30-F27 lleva a los cargos fijos de la tarjeta, una sola vez, sin enviar nada al backend y sin cambiar el detalle', async () => {
    await mostrarDetalle();

    await fireEvent.press(boton('Ver cargos fijos'));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/tarjetas/[id]/cargos',
      params: { id: VISA_ID, nombre: 'Visa Bancolombia' },
    });
    expect(tarjetaPedida()).toHaveBeenCalledTimes(1);
    expect(proyeccionPedida()).toHaveBeenCalledTimes(1);
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(hojaAbierta()).toBe(false);
  });

  it('CA-RF30-F27 lleva el nombre real de la tarjeta (el que responde el backend), no el de la ruta', async () => {
    await mostrarDetalle({ params: { id: VISA_ID, nombre: 'Visa Vieja' } });

    await fireEvent.press(boton('Ver cargos fijos'));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/tarjetas/[id]/cargos',
      params: { id: VISA_ID, nombre: 'Visa Bancolombia' },
    });
  });
});
