import Movimientos from '@/app/movimientos';
import { listarCategorias } from '@/lib/api/categorias';
import {
  actualizarTransaccion,
  eliminarTransaccion,
  listarTransacciones,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { hoy } from '@/lib/fechas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El dinero del avance en efectivo en la lista de Movimientos (criterios/05-compra-con-tarjeta.md, CA-RF28-F15).
// El backend se simula en el borde de los adaptadores.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/api/categorias', () => ({
  ...jest.requireActual('@/lib/api/categorias'),
  listarCategorias: jest.fn(),
}));
jest.mock('@/lib/api/transacciones', () => ({
  ...jest.requireActual('@/lib/api/transacciones'),
  listarTransacciones: jest.fn(),
  actualizarTransaccion: jest.fn(),
  eliminarTransaccion: jest.fn(),
}));

const listar = jest.mocked(listarTransacciones);
const actualizar = jest.mocked(actualizarTransaccion);
const eliminar = jest.mocked(eliminarTransaccion);
const categorias = jest.mocked(listarCategorias);

const ALIMENTACION = {
  id: 'c1',
  nombre: 'Alimentación',
  tipo: 'EGRESO' as const,
  esPredeterminada: true,
};

function movimiento(parcial: Partial<TransaccionListada> = {}): TransaccionListada {
  return {
    id: 't-a',
    tipo: 'EGRESO',
    monto: 45000,
    fecha: hoy(),
    categoriaId: 'c1',
    categoria: ALIMENTACION,
    metodoPago: 'DEBITO',
    descripcion: 'Almuerzo',
    clasificacionFlujo: 'ORDINARIO',
    creadaEn: '2026-09-17T15:00:00.000Z',
    ...parcial,
  };
}

/** Un movimiento de dinero recibido, como el que crea un avance: ingreso en efectivo y sin categoría. */
const dineroRecibido = (parcial: Record<string, unknown> = {}) =>
  movimiento({
    id: 't-avance',
    tipo: 'INGRESO',
    monto: 500000,
    categoriaId: null,
    categoria: null,
    metodoPago: 'EFECTIVO',
    descripcion: 'Avance en efectivo',
    clasificacionFlujo: 'DINERO_RECIBIDO',
    ...parcial,
  } as never);

const hoja = () => screen.queryByText('Editar movimiento');

beforeEach(() => {
  listar.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
  categorias.mockReset().mockResolvedValue([{ ...ALIMENTACION, movimientos: 0 }] as never);
});

async function mostrar(items: TransaccionListada[]) {
  listar.mockResolvedValue({ items, siguienteCursor: null });
  await render(<Movimientos />);
  await screen.findByText(items[0].descripcion || 'Sin categoría');
}

describe('Movimientos: dinero recibido', () => {
  it('CA-RF28-F15 el ingreso del avance se ve con su título, "+ $ 500.000" y "Dinero recibido · Efectivo"', async () => {
    await mostrar([dineroRecibido()]);

    expect(screen.getByText('Avance en efectivo')).toBeOnTheScreen();
    expect(screen.getByText('+ $ 500.000')).toBeOnTheScreen();
    expect(screen.getByText('Dinero recibido · Efectivo')).toBeOnTheScreen();
  });

  it('CA-RF28-F15 al tocar esa fila no se abre la hoja de edición ni se envía nada', async () => {
    await mostrar([dineroRecibido()]);

    await fireEvent.press(screen.getByText('Avance en efectivo'));
    await act(async () => {});

    expect(hoja()).toBeNull();
    expect(screen.queryByText(/Elige una categoría/)).toBeNull();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
    expect(screen.queryByText('Eliminar movimiento')).toBeNull();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF28-F15 con la misma clasificación pero sin descripción el título sigue siendo "Sin categoría"', async () => {
    await mostrar([dineroRecibido({ descripcion: '' })]);

    expect(screen.getByText('Sin categoría')).toBeOnTheScreen();
    expect(screen.getByText('Dinero recibido · Efectivo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Sin categoría'));
    await act(async () => {});
    expect(hoja()).toBeNull();
  });

  it('CA-RF28-F15 el método del dinero recibido es el que trae el movimiento', async () => {
    await mostrar([dineroRecibido({ metodoPago: 'TRANSFERENCIA' })]);

    expect(screen.getByText('Dinero recibido · Transferencia')).toBeOnTheScreen();
  });

  it('CA-RF28-F15 los movimientos ordinarios siguen mostrando solo "Categoría · Método" y se abren al tocarlos', async () => {
    await mostrar([movimiento(), dineroRecibido()]);

    expect(screen.getByText('Alimentación · Tarjeta débito')).toBeOnTheScreen();
    expect(screen.getAllByText(/Dinero recibido/)).toHaveLength(1);

    await fireEvent.press(screen.getByText('Almuerzo'));

    expect(await screen.findByText('Editar movimiento')).toBeOnTheScreen();
  });

  it('CA-RF28-F15 un ingreso ordinario sin clasificación de dinero recibido no dice "Dinero recibido"', async () => {
    await mostrar([
      movimiento({
        id: 't-sueldo',
        tipo: 'INGRESO',
        monto: 3400000,
        descripcion: 'Salario',
        metodoPago: 'TRANSFERENCIA',
        categoria: { id: 'c9', nombre: 'Otros ingresos', tipo: 'INGRESO', esPredeterminada: true },
      }),
    ]);

    expect(screen.getByText('Otros ingresos · Transferencia')).toBeOnTheScreen();
    expect(screen.queryByText(/Dinero recibido/)).toBeNull();
  });
});
