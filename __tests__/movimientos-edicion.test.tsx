import Movimientos from '@/app/movimientos';
import type { Categoria } from '@/lib/api/categorias';
import { listarCategorias } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTransaccion,
  eliminarTransaccion,
  listarTransacciones,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { fechaLarga } from '@/lib/fechas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Edición y eliminación de un movimiento (criterios/02-registro-edicion-eliminacion.md).
// Se simula el backend en el borde de los adaptadores con un servidor en memoria: así las pruebas solo miran
// lo que ve el usuario, sin importar si la lista se recarga o se actualiza la fila.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/api/categorias', () => ({ listarCategorias: jest.fn() }));
jest.mock('@/lib/api/transacciones', () => ({
  ...jest.requireActual('@/lib/api/transacciones'),
  listarTransacciones: jest.fn(),
  actualizarTransaccion: jest.fn(),
  eliminarTransaccion: jest.fn(),
}));

const listar = jest.mocked(listarTransacciones);
const actualizar = jest.mocked(actualizarTransaccion);
const eliminar = jest.mocked(eliminarTransaccion);
const categoriasDelBackend = jest.mocked(listarCategorias);

const CATEGORIAS: Categoria[] = [
  { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c2', nombre: 'Transporte', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c9', nombre: 'Otros ingresos', tipo: 'INGRESO', esPredeterminada: true, movimientos: 0 },
];
const porId = (id: string) => CATEGORIAS.find((c) => c.id === id) as Categoria;

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

/** Servidor en memoria: lo que la pantalla guarda o elimina es lo que la lista vuelve a mostrar. */
let servidor: TransaccionListada[];

function ordenado() {
  return [...servidor].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

const VER_TODO = { includeHiddenElements: true };
const RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

// Los campos pueden reutilizar los componentes del registro ("Monto en pesos", "Nota") o llevar el nombre del diseño
const campoValor = () => screen.getByLabelText(/^(Valor|Monto en pesos)$/);
const campoNota = () => screen.getByLabelText(/^(Descripción \(opcional\)|Nota)$/);
const campoCategoria = () => screen.getByLabelText(/^Categoría/);
const campoMetodo = () => screen.getByLabelText(/^Método de pago/);
const campoFecha = () => screen.getByLabelText(/^Fecha/);

async function abrirEdicion(titulo = 'Almuerzo') {
  await fireEvent.press(await screen.findByText(titulo));
  await screen.findByText('Editar movimiento');
}

/** Lo que se le envió al backend, tal como viaja por la red (sin claves undefined). */
function cambiosEnviados(llamada = 0) {
  return JSON.parse(JSON.stringify(actualizar.mock.calls[llamada][1]));
}

async function sheetCerrada() {
  await waitFor(() => expect(screen.queryByText('Editar movimiento')).toBeNull());
}

describe('Movimientos: editar y eliminar', () => {
  beforeEach(() => {
    servidor = [
      movimiento(),
      movimiento({
        id: 't-b',
        monto: 12000,
        descripcion: '',
        metodoPago: 'EFECTIVO',
        categoriaId: 'c2',
        categoria: porId('c2'),
      }),
    ];
    listar.mockReset().mockImplementation(async () => ({
      items: ordenado().map((m) => ({ ...m })),
      siguienteCursor: null,
    }));
    categoriasDelBackend
      .mockReset()
      .mockImplementation(async (tipo) =>
        CATEGORIAS.filter((c) => !tipo || c.tipo === tipo).map((c) => ({ ...c })),
      );
    actualizar.mockReset().mockImplementation(async (id, cambios) => {
      const i = servidor.findIndex((m) => m.id === id);
      servidor[i] = {
        ...servidor[i],
        ...cambios,
        categoria: porId(cambios.categoriaId ?? servidor[i].categoriaId),
      } as TransaccionListada;
      return servidor[i] as never;
    });
    eliminar.mockReset().mockImplementation(async (id) => {
      servidor = servidor.filter((m) => m.id !== id);
    });
  });

  describe('abrir la hoja de edición', () => {
    it('CA-RF08-01 tocar un movimiento abre "Editar movimiento" con todos sus datos', async () => {
      await render(<Movimientos />);

      await abrirEdicion();

      expect(screen.getByLabelText('Egreso')).toBeSelected();
      expect(campoValor().props.value).toBe('$ 45.000');
      expect(screen.getByText('Alimentación')).toBeOnTheScreen();
      expect(screen.getByText('Tarjeta débito')).toBeOnTheScreen();
      expect(screen.getByText('17/09/2026')).toBeOnTheScreen();
      expect(campoNota().props.value).toBe('Almuerzo');
    });

    it('CA-RF08-02 muestra todos los campos a la vez, con "Guardar cambios" y "Eliminar movimiento"', async () => {
      await render(<Movimientos />);

      await abrirEdicion();

      expect(screen.getByLabelText('Ingreso')).toBeOnTheScreen();
      expect(screen.getByLabelText('Egreso')).toBeOnTheScreen();
      expect(campoValor()).toBeOnTheScreen();
      expect(campoCategoria()).toBeOnTheScreen();
      expect(campoMetodo()).toBeOnTheScreen();
      expect(campoFecha()).toBeOnTheScreen();
      expect(campoNota()).toBeOnTheScreen();
      expect(screen.getByText('Guardar cambios')).toBeOnTheScreen();
      expect(screen.getByText('Eliminar movimiento')).toBeOnTheScreen();
    });

    it('CA-RF08-03 cerrar con la ✕ no guarda nada, ni con cambios escritos', async () => {
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.changeText(campoValor(), '99999');

      await fireEvent.press(screen.getByLabelText('Cerrar'));

      await sheetCerrada();
      expect(actualizar).not.toHaveBeenCalled();
      expect(eliminar).not.toHaveBeenCalled();
      expect(screen.getByText('− $ 45.000')).toBeOnTheScreen();
    });
  });

  describe('guardar cambios', () => {
    it('CA-RF08-04 solo envía lo que cambió', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.changeText(campoValor(), '50000');
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(actualizar.mock.calls[0][0]).toBe('t-a');
      expect(cambiosEnviados()).toEqual({ monto: 50000 });
    });

    it('CA-RF08-05 al guardar la hoja se cierra y la lista muestra el valor nuevo, sin duplicar', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.changeText(campoValor(), '50000');
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await sheetCerrada();
      expect(await screen.findByText('− $ 50.000')).toBeOnTheScreen();
      expect(screen.queryByText('− $ 45.000')).toBeNull();
      expect(screen.getAllByText('Almuerzo')).toHaveLength(1);
    });

    it('CA-RF08-06 cambiar la fecha envía la fecha elegida y reubica el movimiento en su día', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(campoFecha());
      await fireEvent.press(screen.getByLabelText(fechaLarga('2026-09-14')));
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(cambiosEnviados()).toEqual({ fecha: '2026-09-14' });
      await sheetCerrada();
      expect(await screen.findByText('LUNES 14 SEP')).toBeOnTheScreen();
      expect(screen.getByText('JUEVES 17 SEP')).toBeOnTheScreen();
    });

    it('CA-RF08-07 vaciar la nota envía texto vacío y la fila pasa a titularse con la categoría', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.changeText(campoNota(), '');
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(cambiosEnviados()).toEqual({ descripcion: '' });
      await sheetCerrada();
      await waitFor(() => expect(screen.queryByText('Almuerzo')).toBeNull());
      expect(screen.getByText('Alimentación')).toBeOnTheScreen();
    });

    it('CA-RF08-08 sin cambios no llama al backend y cierra la hoja', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(screen.getByText('Guardar cambios'));

      await sheetCerrada();
      expect(actualizar).not.toHaveBeenCalled();
    });

    it('CA-RF08-09 un valor en cero deja "Guardar cambios" deshabilitado y no envía nada', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.changeText(campoValor(), '');

      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
      await fireEvent.press(screen.getByText('Guardar cambios'));
      expect(actualizar).not.toHaveBeenCalled();
      expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
    });

    it('CA-RF08-10 el método de pago ofrece las opciones del registro y la tarjeta de crédito avisa', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(campoMetodo());
      expect(screen.getByLabelText('Efectivo')).toBeOnTheScreen();
      expect(screen.getByLabelText('Transferencia')).toBeOnTheScreen();

      await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
      expect(screen.getByText(/se podrán registrar muy pronto/)).toBeOnTheScreen();
      expect(actualizar).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByLabelText('Transferencia'));
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(cambiosEnviados()).toEqual({ metodoPago: 'TRANSFERENCIA' });
    });

    it('CA-RF08-27 tocar "Tarjeta crédito" no impide guardar el resto: el método queda y el aviso se va al cerrar la lista', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.changeText(campoNota(), 'Almuerzo con amigos');
      await fireEvent.press(campoMetodo());
      await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
      expect(screen.getByText(/se podrán registrar muy pronto/)).toBeOnTheScreen();

      await fireEvent.press(campoMetodo());
      expect(screen.queryByText(/se podrán registrar muy pronto/)).toBeNull();

      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(cambiosEnviados()).toEqual({ descripcion: 'Almuerzo con amigos' });
      await sheetCerrada();
      expect(await screen.findByText('Almuerzo con amigos')).toBeOnTheScreen();
      expect(screen.getByText('Alimentación · Tarjeta débito')).toBeOnTheScreen();
    });

    it('CA-RF08-27 si solo tocó "Tarjeta crédito" no hay cambios: Guardar no llama al backend y cierra la hoja', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(campoMetodo());
      await fireEvent.press(screen.getByLabelText('Tarjeta crédito'));
      await fireEvent.press(campoMetodo());
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await sheetCerrada();
      expect(actualizar).not.toHaveBeenCalled();
    });
  });

  describe('cambiar el tipo', () => {
    it('CA-RF08-11 al pasar a ingreso la categoría queda sin elegir y solo ofrece las de ingreso', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(screen.getByLabelText('Ingreso'));

      expect(screen.queryByText('Alimentación')).toBeNull();
      await fireEvent.press(screen.getByText('Guardar cambios'));
      expect(actualizar).not.toHaveBeenCalled();
      expect(screen.getByText('Elige una categoría de ingreso para guardar.')).toBeOnTheScreen();

      await fireEvent.press(campoCategoria());
      expect(await screen.findByLabelText('Otros ingresos')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Alimentación')).toBeNull();
      expect(screen.queryByLabelText('Transporte')).toBeNull();
    });

    it('CA-RF08-12 con la categoría nueva envía tipo y categoría, y la lista lo muestra como ingreso', async () => {
      await render(<Movimientos />);
      await abrirEdicion();

      await fireEvent.press(screen.getByLabelText('Ingreso'));
      await fireEvent.press(campoCategoria());
      await fireEvent.press(await screen.findByLabelText('Otros ingresos'));
      await fireEvent.press(screen.getByText('Guardar cambios'));

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(cambiosEnviados()).toEqual({ tipo: 'INGRESO', categoriaId: 'c9' });
      await sheetCerrada();
      expect(await screen.findByText('+ $ 45.000')).toBeOnTheScreen();
      expect(screen.queryByText('− $ 45.000')).toBeNull();
    });
  });

  describe('carga y errores al guardar', () => {
    it('CA-RF08-13 dos toques seguidos en "Guardar cambios" envían una sola solicitud y muestran un indicador', async () => {
      const respuesta = pendiente<never>();
      actualizar.mockReturnValueOnce(respuesta.promesa);
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.changeText(campoValor(), '50000');
      const guardar = screen.getByText('Guardar cambios');

      await fireEvent.press(guardar);
      await fireEvent.press(guardar);

      expect(actualizar).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Guardar cambios')).toBeNull();
      await act(async () => respuesta.resolver(servidor[0] as never));
    });

    it('CA-RF08-14 sin conexión avisa, conserva lo escrito y reintenta al volver a guardar', async () => {
      actualizar.mockRejectedValueOnce(new NetworkError());
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.changeText(campoValor(), '50000');

      await fireEvent.press(screen.getByText('Guardar cambios'));

      expect(await screen.findByText(RED)).toBeOnTheScreen();
      expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
      expect(campoValor().props.value).toBe('$ 50.000');

      await fireEvent.press(screen.getByText('Guardar cambios'));

      await sheetCerrada();
      expect(actualizar).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('− $ 50.000')).toBeOnTheScreen();
      expect(screen.queryByText(RED)).toBeNull();
    });

    it.each([400, 500])(
      'CA-RF08-15 ante un %s muestra el mensaje general y conserva todo',
      async (status) => {
        actualizar.mockRejectedValueOnce(new ApiError(status, 'x'));
        await render(<Movimientos />);
        await abrirEdicion();
        await fireEvent.changeText(campoValor(), '50000');

        await fireEvent.press(screen.getByText('Guardar cambios'));

        expect(
          await screen.findByText(
            'No pudimos guardar los cambios. Revisa los datos e inténtalo de nuevo.',
          ),
        ).toBeOnTheScreen();
        expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
        expect(campoValor().props.value).toBe('$ 50.000');
      },
    );

    it('CA-RF08-16 si el movimiento ya no existe (404) avisa y la lista deja de mostrarlo al cerrar', async () => {
      actualizar.mockImplementationOnce(async () => {
        servidor = servidor.filter((m) => m.id !== 't-a');
        throw new ApiError(404, 'No se encontró la transacción');
      });
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.changeText(campoValor(), '50000');

      await fireEvent.press(screen.getByText('Guardar cambios'));

      expect(await screen.findByText('Este movimiento ya no existe.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByLabelText('Cerrar'));
      await sheetCerrada();
      await waitFor(() => expect(screen.queryByText('Almuerzo')).toBeNull());
      expect(screen.getByText('Transporte')).toBeOnTheScreen();
    });

    it('CA-RF08-17 si lo generó otro módulo (409) explica que no se puede cambiar aquí', async () => {
      actualizar.mockRejectedValueOnce(new ApiError(409, 'Esta transacción la genera otro módulo'));
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.changeText(campoValor(), '50000');

      await fireEvent.press(screen.getByText('Guardar cambios'));

      expect(
        await screen.findByText(
          'Este movimiento viene de tarjetas o deudas y no se puede cambiar aquí.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
    });
  });

  describe('eliminar con confirmación', () => {
    async function abrirConfirmacion() {
      await render(<Movimientos />);
      await abrirEdicion();
      await fireEvent.press(screen.getByText('Eliminar movimiento'));
      await screen.findByText('¿Eliminar este movimiento?');
    }

    it('CA-RF08-18 "Eliminar movimiento" pide confirmar y todavía no borra nada', async () => {
      await abrirConfirmacion();

      expect(
        screen.getByText(/Almuerzo · \$ 45\.000 · 17 sep\. Esta acción no se puede deshacer\./),
      ).toBeOnTheScreen();
      expect(screen.getByText('Cancelar')).toBeOnTheScreen();
      expect(screen.getByText('Eliminar')).toBeOnTheScreen();
      expect(eliminar).not.toHaveBeenCalled();
    });

    it('CA-RF08-19 "Cancelar" cierra el diálogo y deja la hoja y el movimiento como estaban', async () => {
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Cancelar'));

      await waitFor(() => expect(screen.queryByText('¿Eliminar este movimiento?')).toBeNull());
      expect(screen.getByText('Editar movimiento')).toBeOnTheScreen();
      expect(campoValor().props.value).toBe('$ 45.000');
      expect(eliminar).not.toHaveBeenCalled();
    });

    it('CA-RF08-20 confirmar elimina, cierra diálogo y hoja, y la lista deja de mostrarlo', async () => {
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Eliminar'));

      await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
      expect(eliminar).toHaveBeenCalledWith('t-a');
      await waitFor(() => expect(screen.queryByText('¿Eliminar este movimiento?')).toBeNull());
      await sheetCerrada();
      await waitFor(() => expect(screen.queryByText('Almuerzo')).toBeNull());
      expect(screen.getByText('Transporte')).toBeOnTheScreen();
    });

    it('CA-RF08-21 dos toques seguidos en "Eliminar" envían un solo borrado', async () => {
      const respuesta = pendiente<void>();
      eliminar.mockReturnValueOnce(respuesta.promesa);
      await abrirConfirmacion();
      const confirmar = screen.getByText('Eliminar');

      await fireEvent.press(confirmar);
      await fireEvent.press(confirmar);

      expect(eliminar).toHaveBeenCalledTimes(1);
      await act(async () => respuesta.resolver());
    });

    it('CA-RF08-22 sin conexión avisa, deja el diálogo abierto y reintenta al volver a confirmar', async () => {
      eliminar.mockRejectedValueOnce(new NetworkError());
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Eliminar'));

      expect(await screen.findByText(RED)).toBeOnTheScreen();
      expect(screen.getByText('¿Eliminar este movimiento?')).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo', VER_TODO)).toBeOnTheScreen();

      await fireEvent.press(screen.getByText('Eliminar'));

      await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText('Almuerzo')).toBeNull());
    });

    it('CA-RF08-22 ante otro fallo muestra el mensaje general y deja el diálogo abierto', async () => {
      eliminar.mockRejectedValueOnce(new ApiError(500, 'x'));
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Eliminar'));

      expect(
        await screen.findByText(
          'No pudimos eliminar el movimiento. Inténtalo de nuevo en unos minutos.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('¿Eliminar este movimiento?')).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo', VER_TODO)).toBeOnTheScreen();
    });

    it('CA-RF08-23 si ya estaba eliminado (404) se da por eliminado, sin mostrar un error', async () => {
      eliminar.mockImplementationOnce(async () => {
        servidor = servidor.filter((m) => m.id !== 't-a');
        throw new ApiError(404, 'No se encontró la transacción');
      });
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Eliminar'));

      await waitFor(() => expect(screen.queryByText('¿Eliminar este movimiento?')).toBeNull());
      await sheetCerrada();
      await waitFor(() => expect(screen.queryByText('Almuerzo')).toBeNull());
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('CA-RF08-24 si lo generó otro módulo (409) explica que no se puede eliminar aquí', async () => {
      eliminar.mockRejectedValueOnce(new ApiError(409, 'Esta transacción la genera otro módulo'));
      await abrirConfirmacion();

      await fireEvent.press(screen.getByText('Eliminar'));

      expect(
        await screen.findByText(
          'Este movimiento viene de tarjetas o deudas y no se puede eliminar aquí.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('¿Eliminar este movimiento?')).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo', VER_TODO)).toBeOnTheScreen();
    });
  });
});
