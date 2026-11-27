import { listarCategorias, renombrarCategoria, type Categoria } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  abrirEdicion,
  campoNombre,
  escribir,
  fila,
  MASCOTAS,
  mostrar,
  reiniciarAdaptador,
  TECNICO,
  TEXTO,
  verIngresos,
} from './ayudas/categorias';
import { reiniciarRouter } from './ayudas/router-simulado';
import { boton, laHoja, pendiente, RED, textoDePantalla, VER_TODO } from './ayudas/tarjetas';

// Renombrar una categoría propia en la hoja "Editar categoría"
// (criterios/02-categorias-gestion.md, CA-RF11-F12 a F19).
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/categorias', () => ({
  listarCategorias: jest.fn(),
  crearCategoria: jest.fn(),
  renombrarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
}));

const listar = jest.mocked(listarCategorias);
const renombrar = jest.mocked(renombrarCategoria);

const hojaAbierta = () => screen.queryByText('Editar categoría', VER_TODO) !== null;
const sinHoja = () => waitFor(() => expect(hojaAbierta()).toBe(false));
const guardar = () => fireEvent.press(boton('Guardar'));

async function abrir() {
  const servidor = await mostrar();
  await abrirEdicion();
  return servidor;
}

beforeEach(() => {
  reiniciarRouter();
  reiniciarAdaptador();
});

describe('Editar categoría: la hoja', () => {
  it('CA-RF11-F12 tocar una propia abre la hoja con su tipo fijo, su nombre, "Guardar" y "Eliminar categoría"', async () => {
    await abrir();

    expect(laHoja().getByText('Editar categoría')).toBeOnTheScreen();
    expect(laHoja().getByText('Egreso')).toBeOnTheScreen();
    expect(laHoja().queryByRole('button', { name: /^(Egreso|Ingreso)s?$/ })).toBeNull();
    expect(campoNombre()).toHaveDisplayValue('Mascotas');
    expect(boton('Guardar')).toBeOnTheScreen();
    expect(boton('Eliminar categoría')).toBeOnTheScreen();
  });

  it('CA-RF11-F12 en una categoría de ingreso la hoja dice "Ingreso"', async () => {
    await mostrar();
    await verIngresos();

    await abrirEdicion('Freelance', 3);

    expect(laHoja().getByText('Ingreso')).toBeOnTheScreen();
    expect(campoNombre()).toHaveDisplayValue('Freelance');
  });

  it('CA-RF11-F13 "Cerrar" descarta lo escrito sin confirmar ni enviar nada', async () => {
    await abrir();
    await escribir('Animales');

    await fireEvent.press(boton('Cerrar'));

    await sinHoja();
    expect(renombrar).not.toHaveBeenCalled();
    await abrirEdicion();
    expect(campoNombre()).toHaveDisplayValue('Mascotas');
  });
});

describe('Editar categoría: guardar', () => {
  it('CA-RF11-F14 envía el nombre recortado, cierra la hoja y la lista se vuelve a pedir', async () => {
    await abrir();
    await escribir('  Animales ');
    listar.mockClear();

    await guardar();

    expect(renombrar).toHaveBeenCalledTimes(1);
    expect(renombrar).toHaveBeenCalledWith(MASCOTAS.id, 'Animales');
    await sinHoja();
    expect(await screen.findByText('Animales')).toBeOnTheScreen();
    expect(fila('Animales', 12)).toBeOnTheScreen();
    expect(screen.queryByText('Mascotas')).toBeNull();
    expect(listar).toHaveBeenCalledWith('EGRESO');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF11-F14 cambiar solo las mayúsculas también se envía', async () => {
    await abrir();
    await escribir('mascotas');

    await guardar();

    expect(renombrar).toHaveBeenCalledWith(MASCOTAS.id, 'mascotas');
  });

  it.each(['Mascotas', '  Mascotas  '])(
    'CA-RF11-F15 sin cambios ("%s") cierra la hoja y no envía nada',
    async (nombre) => {
      await abrir();
      await escribir(nombre);

      await guardar();

      await sinHoja();
      expect(renombrar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['vacío', '', TEXTO.vacio],
    ['solo con espacios', '   ', TEXTO.vacio],
    ['de 41 caracteres', 'a'.repeat(41), TEXTO.largo],
  ])(
    'CA-RF11-F16 un nombre %s avisa, deja la hoja abierta y no se envía',
    async (_, nombre, aviso) => {
      await abrir();
      await escribir(nombre);

      await guardar();

      expect(screen.getByRole('alert')).toHaveTextContent(aviso);
      expect(hojaAbierta()).toBe(true);
      expect(renombrar).not.toHaveBeenCalled();

      await escribir('Animales');
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('CA-RF11-F16 con 40 caracteres sí se envía', async () => {
    await abrir();
    await escribir('a'.repeat(40));

    await guardar();

    expect(renombrar).toHaveBeenCalledWith(MASCOTAS.id, 'a'.repeat(40));
  });

  it('CA-RF11-F17 mientras guarda muestra un indicador, bloquea los botones y un doble toque no repite', async () => {
    await abrir();
    const respuesta = pendiente<Categoria>();
    renombrar.mockReturnValueOnce(respuesta.promesa);
    await escribir('Animales');
    const confirmar = boton('Guardar');
    const eliminar = boton('Eliminar categoría');

    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    expect(renombrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Guardar')).toBeNull();
    expect(confirmar).toBeDisabled();
    expect(eliminar).toBeDisabled();
    expect(hojaAbierta()).toBe(true);

    await act(async () => respuesta.resolver({ ...MASCOTAS, nombre: 'Animales' }));
    await sinHoja();
    expect(renombrar).toHaveBeenCalledTimes(1);
  });
});

describe('Editar categoría: cuando guardar falla', () => {
  it.each([
    ['un 409', new ApiError(409, 'Ya existe una categoría con ese nombre'), TEXTO.repetido],
    ['sin conexión', new NetworkError(), RED],
    ['un 400', new ApiError(400, 'nombre must be shorter'), TEXTO.errorGuardar],
    ['un 403', new ApiError(403, 'Forbidden resource'), TEXTO.errorGuardar],
    ['un 500', new ApiError(500, 'Internal server error'), TEXTO.errorGuardar],
  ])(
    'CA-RF11-F18 con %s avisa, conserva lo escrito y permite reintentar',
    async (_, error, aviso) => {
      await abrir();
      renombrar.mockRejectedValueOnce(error);
      await escribir('Animales');

      await guardar();

      expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
      expect(hojaAbierta()).toBe(true);
      expect(campoNombre()).toHaveDisplayValue('Animales');
      expect(boton('Guardar')).toBeEnabled();
      expect(textoDePantalla()).not.toMatch(TECNICO);

      await guardar();

      expect(renombrar).toHaveBeenCalledTimes(2);
      await sinHoja();
    },
  );

  it('CA-RF11-F18 ante un 401 no muestra aviso propio', async () => {
    await abrir();
    renombrar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await escribir('Animales');

    await guardar();
    await act(async () => {});

    expect(renombrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF11-F19 si ya no existe (404) lo dice en la hoja y la lista se vuelve a pedir sin ella', async () => {
    const servidor = await abrir();
    renombrar.mockImplementationOnce(async (id) => {
      servidor.quitar(id);
      throw new ApiError(404, 'Categoría no encontrada');
    });
    await escribir('Animales');
    listar.mockClear();

    await guardar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.yaNoExiste);
    expect(hojaAbierta()).toBe(true);
    expect(listar).toHaveBeenCalledWith('EGRESO');

    await fireEvent.press(boton('Cerrar'));

    await sinHoja();
    expect(screen.queryByText('Mascotas')).toBeNull();
    expect(screen.getByText('Gimnasio')).toBeOnTheScreen();
  });
});
