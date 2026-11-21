import Movimientos from '@/app/movimientos';
import { listarCategorias } from '@/lib/api/categorias';
import {
  actualizarTransaccion,
  eliminarTransaccion,
  listarTransacciones,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { hoy } from '@/lib/fechas';
import { subtituloDelMovimiento, tituloDelMovimiento } from '@/lib/movimientos';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Cómo se ve un pago de tarjeta (y un abono a una deuda) en la lista de Movimientos: un egreso de solo lectura
// (criterios/05-pago-de-tarjeta.md, CA-RF32-F39 a F41). El backend se simula en el borde de los adaptadores.
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

/** Un pago de tarjeta, como lo lista el backend: egreso sin categoría y con la descripción "Pago de tarjeta". */
const pagoDeTarjeta = (parcial: Record<string, unknown> = {}) =>
  movimiento({
    id: 't-pago',
    monto: 100000,
    categoriaId: null,
    categoria: null,
    metodoPago: 'TRANSFERENCIA',
    descripcion: 'Pago de tarjeta',
    clasificacionFlujo: 'PAGO_TARJETA',
    ...parcial,
  } as never);

/** El abono a una deuda (módulo 6): egreso sin categoría. */
const abonoDeDeuda = (parcial: Record<string, unknown> = {}) =>
  movimiento({
    id: 't-abono',
    monto: 80000,
    categoriaId: null,
    categoria: null,
    metodoPago: 'EFECTIVO',
    descripcion: 'Abono a Juan',
    clasificacionFlujo: 'ABONO_DEUDA',
    ...parcial,
  } as never);

const hoja = () => screen.queryByText('Editar movimiento');

beforeEach(() => {
  listar.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
  categorias.mockReset().mockResolvedValue([{ ...ALIMENTACION, movimientos: 0 }] as never);
});

/** Dibuja Movimientos con esos movimientos y espera a que aparezca el primero (por su monto). */
async function mostrar(items: TransaccionListada[], primerMonto: string) {
  listar.mockResolvedValue({ items, siguienteCursor: null });
  await render(<Movimientos />);
  await screen.findByText(primerMonto);
}

describe('Movimientos: un pago de tarjeta', () => {
  it('CA-RF32-F39 se ve como un egreso con "Pago de tarjeta", "− $ 100.000" y "Pago de tarjeta · Transferencia"', async () => {
    await mostrar([pagoDeTarjeta()], '− $ 100.000');

    expect(screen.getByText('Pago de tarjeta')).toBeOnTheScreen();
    expect(screen.getByText('− $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Pago de tarjeta · Transferencia')).toBeOnTheScreen();
  });

  it('CA-RF32-F39 si el usuario le puso una nota, el título es la nota y el subtítulo sigue siendo "Pago de tarjeta · Transferencia"', async () => {
    await mostrar([pagoDeTarjeta({ descripcion: 'Cuota de noviembre' })], '− $ 100.000');

    expect(screen.getByText('Cuota de noviembre')).toBeOnTheScreen();
    expect(screen.getByText('Pago de tarjeta · Transferencia')).toBeOnTheScreen();
  });

  it('CA-RF32-F39 si llegara sin descripción, el título es "Pago de tarjeta" y nunca "Sin categoría"', async () => {
    await mostrar([pagoDeTarjeta({ descripcion: '' })], '− $ 100.000');

    expect(screen.getByText('Pago de tarjeta')).toBeOnTheScreen();
    expect(screen.getByText('Pago de tarjeta · Transferencia')).toBeOnTheScreen();
    expect(screen.queryByText('Sin categoría')).toBeNull();
  });

  it('CA-RF32-F39 el método del pago es el que trae el movimiento', async () => {
    await mostrar([pagoDeTarjeta({ metodoPago: 'EFECTIVO' })], '− $ 100.000');

    expect(screen.getByText('Pago de tarjeta · Efectivo')).toBeOnTheScreen();
  });

  it('CA-RF32-F39 los movimientos ordinarios siguen mostrando "Categoría · Método" y el dinero recibido "Dinero recibido · Método"', async () => {
    await mostrar(
      [
        movimiento(),
        pagoDeTarjeta(),
        movimiento({
          id: 't-avance',
          tipo: 'INGRESO',
          monto: 500000,
          categoriaId: null,
          categoria: null,
          metodoPago: 'EFECTIVO',
          descripcion: 'Avance en efectivo',
          clasificacionFlujo: 'DINERO_RECIBIDO',
        } as never),
      ],
      '− $ 45.000',
    );

    expect(screen.getByText('Alimentación · Tarjeta débito')).toBeOnTheScreen();
    expect(screen.getByText('Dinero recibido · Efectivo')).toBeOnTheScreen();
    expect(screen.getByText('Pago de tarjeta · Transferencia')).toBeOnTheScreen();
    expect(screen.getAllByText(/Dinero recibido/)).toHaveLength(1);
    expect(screen.getAllByText(/^Pago de tarjeta ·/)).toHaveLength(1);
  });

  it('CA-RF32-F40 al tocar esa fila no se abre la edición ni se envía nada al backend', async () => {
    await mostrar([pagoDeTarjeta()], '− $ 100.000');

    await fireEvent.press(screen.getByText('Pago de tarjeta · Transferencia'));
    await act(async () => {});

    expect(hoja()).toBeNull();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
    expect(screen.queryByText('Eliminar movimiento')).toBeNull();
    expect(screen.queryByText(/Elige una categoría/)).toBeNull();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF32-F40 tocar el título del pago tampoco abre nada', async () => {
    await mostrar([pagoDeTarjeta({ descripcion: 'Cuota de noviembre' })], '− $ 100.000');

    await fireEvent.press(screen.getByText('Cuota de noviembre'));
    await act(async () => {});

    expect(hoja()).toBeNull();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF32-F40 los movimientos ordinarios se siguen abriendo al tocarlos', async () => {
    await mostrar([movimiento(), pagoDeTarjeta()], '− $ 45.000');

    await fireEvent.press(screen.getByText('Almuerzo'));

    expect(await screen.findByText('Editar movimiento')).toBeOnTheScreen();
  });
});

describe('Movimientos: un abono a una deuda', () => {
  it('CA-RF32-F41 se ve con "Abono a Juan", "− $ 80.000" y "Abono a una deuda · Efectivo"', async () => {
    await mostrar([abonoDeDeuda()], '− $ 80.000');

    expect(screen.getByText('Abono a Juan')).toBeOnTheScreen();
    expect(screen.getByText('− $ 80.000')).toBeOnTheScreen();
    expect(screen.getByText('Abono a una deuda · Efectivo')).toBeOnTheScreen();
  });

  it('CA-RF32-F41 al tocarlo no se abre la edición ni se envía nada', async () => {
    await mostrar([abonoDeDeuda()], '− $ 80.000');

    await fireEvent.press(screen.getByText('Abono a Juan'));
    await act(async () => {});

    expect(hoja()).toBeNull();
    expect(screen.queryByText('Guardar cambios')).toBeNull();
    expect(screen.queryByText('Eliminar movimiento')).toBeNull();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });
});

describe('Textos de una fila de pago o de abono', () => {
  it('CA-RF32-F39 el título es la nota si la hay y si no "Pago de tarjeta"; el subtítulo, "Pago de tarjeta · Método"', () => {
    expect(tituloDelMovimiento(pagoDeTarjeta())).toBe('Pago de tarjeta');
    expect(tituloDelMovimiento(pagoDeTarjeta({ descripcion: 'Cuota de noviembre' }))).toBe(
      'Cuota de noviembre',
    );
    expect(tituloDelMovimiento(pagoDeTarjeta({ descripcion: '' }))).toBe('Pago de tarjeta');
    expect(subtituloDelMovimiento(pagoDeTarjeta())).toBe('Pago de tarjeta · Transferencia');
    expect(subtituloDelMovimiento(pagoDeTarjeta({ descripcion: 'Cuota de noviembre' }))).toBe(
      'Pago de tarjeta · Transferencia',
    );
    expect(subtituloDelMovimiento(pagoDeTarjeta({ metodoPago: 'DEBITO' }))).toBe(
      'Pago de tarjeta · Tarjeta débito',
    );
  });

  it('CA-RF32-F41 el subtítulo de un abono a una deuda es "Abono a una deuda · Método"', () => {
    expect(subtituloDelMovimiento(abonoDeDeuda())).toBe('Abono a una deuda · Efectivo');
    expect(tituloDelMovimiento(abonoDeDeuda())).toBe('Abono a Juan');
  });

  it('CA-RF32-F39 un movimiento ordinario conserva su subtítulo y su título', () => {
    expect(subtituloDelMovimiento(movimiento())).toBe('Alimentación · Tarjeta débito');
    expect(tituloDelMovimiento(movimiento({ descripcion: '' }))).toBe('Alimentación');
  });
});
