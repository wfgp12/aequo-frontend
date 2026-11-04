import Movimientos from '@/app/movimientos';
import type { Categoria } from '@/lib/api/categorias';
import { crearCategoria, listarCategorias } from '@/lib/api/categorias';
import {
  actualizarTransaccion,
  listarTransacciones,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Crear una categoría desde la hoja "Editar movimiento" (criterios/02-categorias-crear.md). Igual que
// movimientos-edicion.test.tsx: el backend se simula en el borde de los adaptadores con un servidor en memoria.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/api/categorias', () => ({ listarCategorias: jest.fn(), crearCategoria: jest.fn() }));
jest.mock('@/lib/api/transacciones', () => ({
  ...jest.requireActual('@/lib/api/transacciones'),
  listarTransacciones: jest.fn(),
  actualizarTransaccion: jest.fn(),
}));

const listar = jest.mocked(listarTransacciones);
const actualizar = jest.mocked(actualizarTransaccion);
const categoriasDelBackend = jest.mocked(listarCategorias);
const crear = jest.mocked(crearCategoria);

const CATEGORIAS: Categoria[] = [
  { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c2', nombre: 'Transporte', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c9', nombre: 'Otros ingresos', tipo: 'INGRESO', esPredeterminada: true, movimientos: 0 },
];
const mascotas: Categoria = {
  id: 'c20',
  nombre: 'Mascotas',
  tipo: 'EGRESO',
  esPredeterminada: false,
  movimientos: 0,
};
const becas: Categoria = {
  id: 'c21',
  nombre: 'Becas',
  tipo: 'INGRESO',
  esPredeterminada: false,
  movimientos: 0,
};
const porId = (id: string) => [...CATEGORIAS, mascotas, becas].find((c) => c.id === id) as Categoria;

function movimiento(parcial: Partial<TransaccionListada> = {}): TransaccionListada {
  return {
    id: 't-a',
    tipo: 'EGRESO',
    monto: 45000,
    fecha: '2026-09-17',
    categoriaId: 'c1',
    categoria: porId('c1'),
    metodoPago: 'DEBITO',
    descripcion: 'Almuerzo',
    clasificacionFlujo: 'ORDINARIO',
    creadaEn: '2026-09-17T15:00:00.000Z',
    ...parcial,
  };
}

/** Servidor en memoria: lo que la pantalla guarda es lo que la lista vuelve a mostrar. */
let servidor: TransaccionListada[];

// Mismo formato que valida el backend para Idempotency-Key
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const campoValor = () => screen.getByLabelText(/^(Valor|Monto en pesos)$/);
const campoCategoria = () => screen.getByLabelText(/^Categoría/);

async function abrirEdicion(titulo = 'Almuerzo') {
  await fireEvent.press(await screen.findByText(titulo));
  await screen.findByText('Editar movimiento');
}

async function abrirHojaDeCategoriaNueva() {
  await fireEvent.press(campoCategoria());
  await fireEvent.press(await screen.findByLabelText('Agregar categoría'));
  await screen.findByText('Nueva categoría');
}

async function crearYGuardar(nombre: string) {
  await fireEvent.changeText(screen.getByLabelText('Nombre'), nombre);
  await fireEvent.press(screen.getByText('Guardar'));
}

function cambiosEnviados(llamada = 0) {
  return JSON.parse(JSON.stringify(actualizar.mock.calls[llamada][1]));
}

describe('Movimientos: crear categoría desde la hoja de edición', () => {
  beforeEach(() => {
    servidor = [
      movimiento(),
      movimiento({
        id: 't-i',
        tipo: 'INGRESO',
        monto: 2500000,
        fecha: '2026-09-15',
        descripcion: 'Sueldo',
        metodoPago: 'TRANSFERENCIA',
        categoriaId: 'c9',
        categoria: porId('c9'),
      }),
    ];
    listar.mockReset().mockImplementation(async () => ({
      items: servidor.map((m) => ({ ...m })),
      siguienteCursor: null,
    }));
    categoriasDelBackend
      .mockReset()
      .mockImplementation(async (tipo) =>
        CATEGORIAS.filter((c) => !tipo || c.tipo === tipo).map((c) => ({ ...c })),
      );
    crear
      .mockReset()
      .mockImplementation(async ({ tipo }) => ({ ...(tipo === 'INGRESO' ? becas : mascotas) }));
    actualizar.mockReset().mockImplementation(async (id, cambios) => {
      const i = servidor.findIndex((m) => m.id === id);
      servidor[i] = {
        ...servidor[i],
        ...cambios,
        categoria: porId(cambios.categoriaId ?? servidor[i].categoriaId),
      } as TransaccionListada;
      return servidor[i] as never;
    });
  });

  it('CA-RF10-F03 el campo "Categoría" abierto ofrece "+ Agregar categoría" al final de la lista', async () => {
    await render(<Movimientos />);
    await abrirEdicion();

    await fireEvent.press(campoCategoria());

    expect(await screen.findByLabelText('Transporte')).toBeOnTheScreen();
    expect(screen.getByText('+ Agregar categoría')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Agregar categoría' })).toBeOnTheScreen();
  });

  it('CA-RF10-F06 la hoja de un movimiento de egreso crea la categoría con tipo EGRESO', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await abrirHojaDeCategoriaNueva();

    await crearYGuardar('Mascotas');

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Mascotas', tipo: 'EGRESO' });
    expect(crear.mock.calls[0][1]).toMatch(UUID);
  });

  it('CA-RF10-F06 la hoja de un movimiento de ingreso crea la categoría con tipo INGRESO', async () => {
    await render(<Movimientos />);
    await abrirEdicion('Sueldo');
    await abrirHojaDeCategoriaNueva();

    await crearYGuardar('Becas');

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Becas', tipo: 'INGRESO' });
  });

  it('CA-RF10-F06 si el usuario cambió el tipo del movimiento, la categoría se crea con el tipo que muestra la hoja', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await fireEvent.press(screen.getByLabelText('Ingreso'));
    await abrirHojaDeCategoriaNueva();

    await crearYGuardar('Becas');

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Becas', tipo: 'INGRESO' });
  });

  it('CA-RF10-F08 cerrar la hoja con la ✕ no crea nada y deja la edición sin cambios', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await fireEvent.changeText(campoValor(), '50000');
    await abrirHojaDeCategoriaNueva();
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Mascotas');

    // Con la hoja abierta puede haber dos ✕ (la de la edición y la de la hoja nueva); la de la hoja nueva es la última
    await fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);

    await waitFor(() => expect(screen.queryByText('Nueva categoría')).toBeNull());
    expect(crear).not.toHaveBeenCalled();
    expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
    expect(campoValor().props.value).toBe('$ 50.000');
    expect(screen.getByLabelText('Categoría, Alimentación')).toBeOnTheScreen();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF10-F15 la categoría nueva queda seleccionada en el campo "Categoría" y se envía al guardar los cambios', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await abrirHojaDeCategoriaNueva();

    await crearYGuardar('Mascotas');

    await waitFor(() => expect(screen.queryByText('Nueva categoría')).toBeNull());
    expect(await screen.findByLabelText('Categoría, Mascotas')).toBeOnTheScreen();
    expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(actualizar).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(cambiosEnviados()).toEqual({ categoriaId: 'c20' });
    await waitFor(() => expect(screen.queryByText('Editar movimiento')).toBeNull());
    expect(await screen.findByText('Mascotas · Tarjeta débito')).toBeOnTheScreen();
  });

  it('CA-RF10-F15 al cambiar de tipo y crear una categoría nueva, se envían el tipo y la categoría nueva', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await fireEvent.press(screen.getByLabelText('Ingreso'));
    await abrirHojaDeCategoriaNueva();

    await crearYGuardar('Becas');

    expect(await screen.findByLabelText('Categoría, Becas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(cambiosEnviados()).toEqual({ tipo: 'INGRESO', categoriaId: 'c21' });
  });

  it('CA-RF10-F15 no se vuelve a pedir la lista de categorías al crear', async () => {
    await render(<Movimientos />);
    await abrirEdicion();
    await abrirHojaDeCategoriaNueva();
    const pedidasAntes = categoriasDelBackend.mock.calls.length;

    await crearYGuardar('Mascotas');

    await screen.findByLabelText('Categoría, Mascotas');
    expect(categoriasDelBackend).toHaveBeenCalledTimes(pedidasAntes);
  });
});
