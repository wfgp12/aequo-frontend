import { ApiError, NetworkError } from '@/lib/api/client';
import type { DeudaConPrestamos } from '@/lib/api/deudas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { conCodigo } from './ayudas/errores';
import {
  dejarHoy,
  eliminar,
  fijarHoy,
  JUAN,
  listar,
  montarDetalle,
  PAPA,
  plano,
  TEXTO,
  vecesQueVolvio,
} from './ayudas/prestamos';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, pendiente, RED, VER_TODO } from './ayudas/tarjetas';

// Eliminar un monto prestado (criterios/06-prestamos.md, CA-RF34-F22 a F26). El backend se simula en el borde del
// adaptador con una lista en memoria.
jest.mock('expo-router', () => {
  const simulado = require('./ayudas/router-simulado');
  return {
    ...simulado.expoRouterSimulado(),
    useRouter: () => ({ ...simulado.router, canGoBack: () => true }),
  };
});
jest.mock('@/lib/api/deudas', () => ({
  listarDeudas: jest.fn(),
  registrarPrestamo: jest.fn(),
  eliminarPrestamo: jest.fn(),
}));

const DEL_ARRIENDO = 'Eliminar el préstamo de $ 200.000, 20 de septiembre de 2026';
const DE_AGOSTO = 'Eliminar el préstamo de $ 500.000, 15 de agosto de 2026';
const DE_JUAN = 'Eliminar el préstamo de $ 300.000, 5 de julio de 2026';
const DETALLE =
  'Se quitará el préstamo de $ 200.000 (20 de septiembre de 2026) y su movimiento. Esta acción no se puede deshacer.';
const ES_EL_UNICO = /Es el único, así que Juan saldrá de tus préstamos\./;

const dialogoAbierto = () => screen.queryByText(TEXTO.tituloDialogo) !== null;

/** Lo que el servidor tiene: lo que se elimina deja de venir en la siguiente consulta. */
let servidor: DeudaConPrestamos[] = [];
function quitar(prestamoId: string) {
  servidor = servidor
    .map((d) => ({ ...d, prestamos: d.prestamos.filter((p) => p.id !== prestamoId) }))
    .filter((d) => d.prestamos.length > 0);
}

async function abrirDialogo(deuda: DeudaConPrestamos = PAPA, nombre = DEL_ARRIENDO) {
  await montarDetalle(deuda);
  await fireEvent.press(await screen.findByRole('button', { name: nombre }));
  await screen.findByText(TEXTO.tituloDialogo);
}
const confirmar = () => fireEvent.press(boton('Eliminar'));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  servidor = [PAPA, JUAN];
  listar()
    .mockReset()
    .mockImplementation(async () => servidor);
  eliminar()
    .mockReset()
    .mockImplementation(async (_deudaId, prestamoId) => quitar(prestamoId));
});
afterEach(() => dejarHoy());

describe('Eliminar un monto: la confirmación', () => {
  it('CA-RF34-F22 pide confirmación sin llamar todavía al backend', async () => {
    await abrirDialogo();

    expect(screen.getByText(DETALLE)).toBeOnTheScreen();
    expect(screen.queryByText(/Es el único/)).toBeNull();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
    expect(eliminar()).not.toHaveBeenCalled();
  });

  it('CA-RF34-F22 "Cancelar" cierra el diálogo sin eliminar nada', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).not.toHaveBeenCalled();
    expect(boton(DEL_ARRIENDO)).toBeOnTheScreen();
  });

  it('CA-RF34-F23 confirmar elimina solo ese monto, cierra el diálogo y vuelve a pedir el detalle', async () => {
    await abrirDialogo();

    await confirmar();

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar()).toHaveBeenCalledTimes(1);
    expect(eliminar()).toHaveBeenCalledWith('deuda-papa', 'p-arriendo');
    await waitFor(() => expect(screen.queryByText('Para el arriendo')).toBeNull());
    expect(listar()).toHaveBeenCalledTimes(2);
    expect(boton(DE_AGOSTO)).toBeOnTheScreen();
    expect(vecesQueVolvio()).toBe(0);
  });

  it('CA-RF34-F23 mientras elimina muestra un indicador y el doble toque no repite', async () => {
    const respuesta = pendiente<void>();
    eliminar().mockReturnValue(respuesta.promesa);
    await abrirDialogo();
    const botonEliminar = boton('Eliminar');

    await fireEvent.press(botonEliminar);
    await fireEvent.press(botonEliminar);

    expect(eliminar()).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Eliminar')).toBeNull();
    expect(botonEliminar).toBeDisabled();

    await act(async () => respuesta.resolver());

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
  });

  it('CA-RF34-F24 si es el único monto, lo advierte y al confirmar regresa a "Mis préstamos"', async () => {
    await abrirDialogo(JUAN, DE_JUAN);

    expect(screen.getByText(ES_EL_UNICO)).toBeOnTheScreen();
    expect(screen.getByText(/Se quitará el préstamo de \$ 300\.000/)).toBeOnTheScreen();
    expect(vecesQueVolvio()).toBe(0);

    await confirmar();

    await waitFor(() => expect(vecesQueVolvio()).toBe(1));
    expect(eliminar()).toHaveBeenCalledWith('deuda-juan', 'p-juan');
  });
});

describe('Eliminar un monto: si ya no existe', () => {
  const noEncontrado = (code: string) => conCodigo(404, code);

  it.each(['DEUDA_NO_ENCONTRADA', 'PRESTAMO_NO_ENCONTRADO'])(
    'CA-RF34-F25 con %s cierra el diálogo sin aviso y vuelve a pedir el detalle',
    async (code) => {
      eliminar().mockImplementation(async () => {
        quitar('p-arriendo');
        throw noEncontrado(code);
      });
      await abrirDialogo();

      await confirmar();

      await waitFor(() => expect(dialogoAbierto()).toBe(false));
      await waitFor(() => expect(screen.queryByText('Para el arriendo')).toBeNull());
      expect(listar()).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it.each(['DEUDA_NO_ENCONTRADA', 'PRESTAMO_NO_ENCONTRADO'])(
    'CA-RF34-F25 con %s en el único monto regresa a "Mis préstamos" sin aviso',
    async (code) => {
      eliminar().mockRejectedValue(noEncontrado(code));
      await abrirDialogo(JUAN, DE_JUAN);

      await confirmar();

      await waitFor(() => expect(vecesQueVolvio()).toBe(1));
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );
});

describe('Eliminar un monto: errores', () => {
  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['409 con abonos', conCodigo(409, 'DEUDA_CON_ABONOS', 'mensaje del servidor'), TEXTO.conAbonos],
    ['500', new ApiError(500, 'Internal server error'), TEXTO.errorEliminar],
  ])(
    'CA-RF34-F26 %s: el diálogo sigue abierto, el monto sigue ahí y lo explica',
    async (_caso, fallo, mensaje) => {
      eliminar().mockRejectedValue(fallo);
      await abrirDialogo();

      await confirmar();

      expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
      expect(dialogoAbierto()).toBe(true);
      expect(plano()).not.toContain(fallo.message);
      expect(screen.getByText('Para el arriendo', VER_TODO)).toBeTruthy();
      expect(vecesQueVolvio()).toBe(0);
    },
  );
});
