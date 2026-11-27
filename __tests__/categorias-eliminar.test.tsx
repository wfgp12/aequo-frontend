import { eliminarCategoria, listarCategorias, renombrarCategoria } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  abrirEdicion,
  campoNombre,
  escribir,
  GENERALES_EGRESO,
  GENERALES_INGRESO,
  FREELANCE,
  MASCOTAS,
  mostrar,
  reiniciarAdaptador,
  TECNICO,
  TEXTO,
  verIngresos,
} from './ayudas/categorias';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, pendiente, RED, textoDePantalla, VER_TODO } from './ayudas/tarjetas';

// Eliminar una categoría propia con confirmación (criterios/02-categorias-gestion.md, CA-RF12-F01 a F08).
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/categorias', () => ({
  listarCategorias: jest.fn(),
  crearCategoria: jest.fn(),
  renombrarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
}));

const listar = jest.mocked(listarCategorias);
const eliminar = jest.mocked(eliminarCategoria);

const TITULO = '¿Eliminar "Mascotas"?';
const DETALLE = 'Sus 12 movimientos no se borran: pasarán a la categoría "Otros egresos".';

const dialogoAbierto = () => screen.queryByText(TITULO, VER_TODO) !== null;
const hojaAbierta = () => screen.queryByText('Editar categoría', VER_TODO) !== null;
const hayMascotas = () => screen.queryAllByText('Mascotas', VER_TODO).length > 0;
const cerrados = () =>
  waitFor(() => {
    expect(dialogoAbierto()).toBe(false);
    expect(hojaAbierta()).toBe(false);
  });

async function abrirDialogo() {
  const servidor = await mostrar();
  await abrirEdicion();
  await fireEvent.press(boton('Eliminar categoría'));
  await screen.findByText(TITULO);
  return servidor;
}

beforeEach(() => {
  reiniciarRouter();
  reiniciarAdaptador();
});

describe('Eliminar categoría: confirmación', () => {
  it('CA-RF12-F01 pide confirmar, explica qué pasa con los movimientos y todavía no elimina', async () => {
    await abrirDialogo();

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText(DETALLE)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF12-F01 el título usa el nombre guardado, no el que está sin guardar', async () => {
    await mostrar();
    await abrirEdicion();
    await escribir('Animales');

    await fireEvent.press(boton('Eliminar categoría'));

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(jest.mocked(renombrarCategoria)).not.toHaveBeenCalled();
  });

  it('CA-RF12-F02 en un ingreso el respaldo es "Otros ingresos"', async () => {
    await mostrar();
    await verIngresos();
    await abrirEdicion('Freelance', 3);

    await fireEvent.press(boton('Eliminar categoría'));

    expect(await screen.findByText('¿Eliminar "Freelance"?')).toBeOnTheScreen();
    expect(
      screen.getByText('Sus 3 movimientos no se borran: pasarán a la categoría "Otros ingresos".'),
    ).toBeOnTheScreen();
  });

  it.each([
    ['egreso', 1, 'Su movimiento no se borra: pasará a la categoría "Otros egresos".'],
    [
      'egreso',
      0,
      'Lo que hayas anotado con esta categoría no se borra: pasará a la categoría "Otros egresos".',
    ],
    ['ingreso', 1, 'Su movimiento no se borra: pasará a la categoría "Otros ingresos".'],
    [
      'ingreso',
      0,
      'Lo que hayas anotado con esta categoría no se borra: pasará a la categoría "Otros ingresos".',
    ],
  ])(
    'CA-RF12-F03 en un %s con %s movimientos el texto se ajusta',
    async (tipo, movimientos, texto) => {
      const propia = { ...(tipo === 'egreso' ? MASCOTAS : FREELANCE), movimientos };
      await mostrar([...GENERALES_EGRESO, ...GENERALES_INGRESO, propia]);
      if (tipo === 'ingreso') await verIngresos();
      await abrirEdicion(propia.nombre, movimientos);

      await fireEvent.press(boton('Eliminar categoría'));

      expect(await screen.findByText(texto)).toBeOnTheScreen();
    },
  );

  it('CA-RF12-F04 "Cancelar" cierra el diálogo sin eliminar y la hoja sigue como estaba', async () => {
    await mostrar();
    await abrirEdicion();
    await escribir('Animales');
    await fireEvent.press(boton('Eliminar categoría'));
    await screen.findByText(TITULO);

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(hojaAbierta()).toBe(true);
    expect(campoNombre()).toHaveDisplayValue('Animales');
    expect(eliminar).not.toHaveBeenCalled();
  });
});

describe('Eliminar categoría: confirmar', () => {
  it('CA-RF12-F05 elimina, cierra diálogo y hoja y la lista se vuelve a pedir sin la categoría', async () => {
    await abrirDialogo();
    listar.mockClear();

    await fireEvent.press(boton('Eliminar'));

    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(eliminar).toHaveBeenCalledWith(MASCOTAS.id);
    await cerrados();
    expect(listar).toHaveBeenCalledWith('EGRESO');
    await waitFor(() => expect(hayMascotas()).toBe(false));
    expect(screen.getByText('Gimnasio')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF12-F06 mientras elimina muestra un indicador, bloquea los botones y un doble toque no repite', async () => {
    await abrirDialogo();
    const respuesta = pendiente<void>();
    eliminar.mockReturnValueOnce(respuesta.promesa);
    const confirmar = boton('Eliminar');
    const cancelar = boton('Cancelar');

    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Eliminar')).toBeNull();
    expect(confirmar).toBeDisabled();
    expect(cancelar).toBeDisabled();
    await act(async () => respuesta.resolver());
    await cerrados();
    expect(eliminar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF12-F07 si ya estaba eliminada (404) cierra todo, vuelve a pedir la lista y no avisa', async () => {
    const servidor = await abrirDialogo();
    eliminar.mockImplementationOnce(async (id) => {
      servidor.quitar(id);
      throw new ApiError(404, 'Categoría no encontrada');
    });
    listar.mockClear();

    await fireEvent.press(boton('Eliminar'));

    await cerrados();
    expect(listar).toHaveBeenCalledWith('EGRESO');
    await waitFor(() => expect(hayMascotas()).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['un 403', new ApiError(403, 'Forbidden resource'), TEXTO.errorEliminar],
    ['un 500', new ApiError(500, 'Internal server error'), TEXTO.errorEliminar],
  ])(
    'CA-RF12-F08 con %s la categoría sigue, avisa y permite reintentar',
    async (_, error, aviso) => {
      await abrirDialogo();
      eliminar.mockRejectedValueOnce(error);

      await fireEvent.press(boton('Eliminar'));

      expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
      expect(dialogoAbierto()).toBe(true);
      expect(boton('Eliminar')).toBeEnabled();
      expect(boton('Cancelar')).toBeEnabled();
      expect(hayMascotas()).toBe(true);
      expect(textoDePantalla()).not.toMatch(TECNICO);

      await fireEvent.press(boton('Eliminar'));

      expect(eliminar).toHaveBeenCalledTimes(2);
      await cerrados();
      await waitFor(() => expect(hayMascotas()).toBe(false));
    },
  );

  it('CA-RF12-F08 ante un 401 no muestra aviso propio', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await fireEvent.press(boton('Eliminar'));
    await act(async () => {});

    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
