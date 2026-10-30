import Movimientos from '@/app/movimientos';
import { NetworkError } from '@/lib/api/client';
import {
  listarTransacciones,
  type PaginaDeTransacciones,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { ayer, fechaLarga, hoy } from '@/lib/fechas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/api/transacciones', () => ({ listarTransacciones: jest.fn() }));

const listar = jest.mocked(listarTransacciones);

function movimiento(parcial: Partial<TransaccionListada> = {}): TransaccionListada {
  return {
    id: 't1',
    tipo: 'EGRESO',
    monto: 45000,
    fecha: hoy(),
    categoriaId: 'c1',
    categoria: { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true },
    metodoPago: 'DEBITO',
    descripcion: 'Almuerzo',
    clasificacionFlujo: 'ORDINARIO',
    creadaEn: '2026-09-17T15:00:00.000Z',
    ...parcial,
  };
}

const primeraPagina: PaginaDeTransacciones = {
  items: [
    movimiento({ id: 'a' }),
    movimiento({
      id: 'b',
      descripcion: '',
      monto: 12000,
      metodoPago: 'EFECTIVO',
      categoria: { id: 'c2', nombre: 'Transporte', tipo: 'EGRESO', esPredeterminada: true },
    }),
    movimiento({
      id: 'c',
      fecha: ayer(),
      tipo: 'INGRESO',
      monto: 3400000,
      descripcion: 'Salario',
      metodoPago: 'TRANSFERENCIA',
      categoria: { id: 'c9', nombre: 'Otros ingresos', tipo: 'INGRESO', esPredeterminada: true },
    }),
    movimiento({
      id: 'd',
      fecha: '2020-03-02',
      monto: 38000,
      descripcion: 'Farmacia',
      metodoPago: 'EFECTIVO',
    }),
  ],
  siguienteCursor: null,
};

// Una respuesta que el test resuelve cuando quiere, para simular al backend tardando
function pendiente() {
  let resolver!: (pagina: PaginaDeTransacciones) => void;
  const promesa = new Promise<PaginaDeTransacciones>((r) => (resolver = r));
  return { promesa, resolver };
}

const primeroDelMes = `${hoy().slice(0, 8)}01`;

async function elegirDesdeElPrimeroDelMes() {
  await fireEvent.press(screen.getByLabelText('Desde: sin fecha'));
  await fireEvent.press(screen.getByLabelText(fechaLarga(primeroDelMes)));
}

describe('Movimientos', () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue(primeraPagina);
  });

  describe('lo que muestra cada movimiento', () => {
    it('CA-RF06-01 muestra título, "Categoría · Método" y el monto con su signo', async () => {
      await render(<Movimientos />);

      expect(await screen.findByText('Almuerzo')).toBeOnTheScreen();
      expect(screen.getByText('Alimentación · Tarjeta débito')).toBeOnTheScreen();
      expect(screen.getByText('− $ 45.000')).toBeOnTheScreen();
      expect(screen.getByText('Salario')).toBeOnTheScreen();
      expect(screen.getByText('+ $ 3.400.000')).toBeOnTheScreen();
    });

    it('CA-RF06-02 sin nota el título es la categoría y debajo solo va el método', async () => {
      await render(<Movimientos />);

      expect(await screen.findByText('Transporte')).toBeOnTheScreen();
      expect(screen.getByText('Efectivo', { exact: true })).toBeOnTheScreen();
      expect(screen.queryByText('Transporte · Efectivo')).toBeNull();
    });

    it('CA-RF06-03 cada método de pago se lee con su nombre cotidiano', async () => {
      listar.mockResolvedValue({
        items: [
          movimiento({ id: 'm1', metodoPago: 'EFECTIVO' }),
          movimiento({ id: 'm2', metodoPago: 'DEBITO' }),
          movimiento({ id: 'm3', metodoPago: 'TRANSFERENCIA' }),
          movimiento({ id: 'm4', metodoPago: 'TARJETA_CREDITO' }),
        ],
        siguienteCursor: null,
      });
      await render(<Movimientos />);

      expect(await screen.findByText('Alimentación · Efectivo')).toBeOnTheScreen();
      expect(screen.getByText('Alimentación · Tarjeta débito')).toBeOnTheScreen();
      expect(screen.getByText('Alimentación · Transferencia')).toBeOnTheScreen();
      expect(screen.getByText('Alimentación · Tarjeta crédito')).toBeOnTheScreen();
    });

    it('CA-RF06-04 el monto se muestra redondeado al peso', async () => {
      listar.mockResolvedValue({
        items: [movimiento({ monto: 45000.6 })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);

      expect(await screen.findByText('− $ 45.001')).toBeOnTheScreen();
    });

    it('CA-RF06-06 un movimiento sin nota ni categoría se titula "Sin categoría"', async () => {
      listar.mockResolvedValue({
        items: [movimiento({ descripcion: '', categoria: null, metodoPago: 'EFECTIVO' })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);

      expect(await screen.findByText('Sin categoría')).toBeOnTheScreen();
      expect(screen.getByText('Efectivo', { exact: true })).toBeOnTheScreen();
    });
  });

  describe('agrupación por día', () => {
    it('CA-RF06-05 pone un encabezado por día: hoy, ayer y los anteriores', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      expect(screen.getAllByText(/^HOY · /)).toHaveLength(1);
      expect(screen.getAllByText(/^AYER · /)).toHaveLength(1);
      expect(screen.getByText('LUNES 2 MAR')).toBeOnTheScreen();
    });

    it('CA-RF06-05 los movimientos del mismo día comparten encabezado y siguen el orden recibido', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      const textos = screen.getAllByText(/^(HOY · |AYER · |LUNES 2 MAR|Almuerzo$|Transporte$|Salario$|Farmacia$)/);
      expect(textos.map((t) => t.props.children)).toEqual([
        expect.stringMatching(/^HOY · /),
        'Almuerzo',
        'Transporte',
        expect.stringMatching(/^AYER · /),
        'Salario',
        'LUNES 2 MAR',
        'Farmacia',
      ]);
    });
  });

  describe('carga de la lista', () => {
    it('CA-RF06-07 al abrir hace una sola consulta con "Hasta" en hoy, sin "Desde" ni límite', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      expect(listar).toHaveBeenCalledTimes(1);
      const filtros = listar.mock.calls[0][0];
      expect(filtros).toEqual({ hasta: hoy() });
      expect(filtros).not.toHaveProperty('limite');
      expect(filtros).not.toHaveProperty('cursor');
    });

    it('CA-RF06-08 mientras el backend responde muestra un indicador y ni lista vacía ni error', async () => {
      listar.mockReturnValue(pendiente().promesa);
      await render(<Movimientos />);

      expect(screen.getByLabelText('Cargando tus movimientos')).toBeOnTheScreen();
      expect(screen.queryByText('No hay movimientos en este periodo.')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('CA-RF06-08 al terminar de cargar el indicador desaparece', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      expect(screen.queryByLabelText('Cargando tus movimientos')).toBeNull();
    });

    it('CA-RF06-09 sin movimientos avisa con un texto sencillo y no muestra la lista', async () => {
      listar.mockResolvedValue({ items: [], siguienteCursor: null });
      await render(<Movimientos />);

      expect(await screen.findByText('No hay movimientos en este periodo.')).toBeOnTheScreen();
      expect(screen.queryByTestId('lista-movimientos')).toBeNull();
    });

    it('CA-RF06-10 si falla por conexión avisa y "Reintentar" vuelve a consultar', async () => {
      listar.mockRejectedValueOnce(new NetworkError());
      await render(<Movimientos />);

      expect(
        await screen.findByText(
          'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
        ),
      ).toBeOnTheScreen();

      await fireEvent.press(screen.getByText('Reintentar'));

      expect(await screen.findByText('Almuerzo')).toBeOnTheScreen();
      expect(listar).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('CA-RF06-10 ante cualquier otro fallo muestra el mensaje general, sin jerga técnica', async () => {
      listar.mockRejectedValue(new Error('boom'));
      await render(<Movimientos />);

      expect(
        await screen.findByText(
          'No pudimos cargar tus movimientos. Inténtalo de nuevo en unos minutos.',
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/boom/)).toBeNull();
      expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    });
  });

  describe('carga progresiva', () => {
    const paginaConCursor: PaginaDeTransacciones = {
      items: primeraPagina.items.slice(0, 2),
      siguienteCursor: 'cursor-1',
    };

    it('CA-RF06-11 al llegar al final pide la página siguiente con el cursor y la agrega al final', async () => {
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockResolvedValueOnce({
        items: [movimiento({ id: 'e', descripcion: 'Mercado', monto: 230000 })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(await screen.findByText('Mercado')).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo')).toBeOnTheScreen();
      expect(listar).toHaveBeenLastCalledWith({ hasta: hoy(), cursor: 'cursor-1' });
    });

    it('CA-RF06-11 mientras llega la página siguiente muestra "Cargando más…"', async () => {
      const siguiente = pendiente();
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockReturnValueOnce(siguiente.promesa);
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');
      expect(screen.queryByText('Cargando más…')).toBeNull();

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(await screen.findByText('Cargando más…')).toBeOnTheScreen();
      await act(async () => siguiente.resolver({ items: [], siguienteCursor: null }));
      await waitFor(() => expect(screen.queryByText('Cargando más…')).toBeNull());
    });

    it('CA-RF06-12 cuando ya no hay más páginas no vuelve a pedir', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(listar).toHaveBeenCalledTimes(1);
    });

    it('CA-RF06-12 tras la última página vuelve a quedar sin cursor y no pide más', async () => {
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockResolvedValueOnce({
        items: [movimiento({ id: 'e', descripcion: 'Mercado' })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');
      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');
      await screen.findByText('Mercado');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(listar).toHaveBeenCalledTimes(2);
    });

    it('CA-RF06-13 no pide dos veces la misma página mientras una carga sigue en curso', async () => {
      const siguiente = pendiente();
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockReturnValueOnce(siguiente.promesa);
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');
      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(listar).toHaveBeenCalledTimes(2);
      await act(async () => siguiente.resolver({ items: [], siguienteCursor: null }));
    });

    it('CA-RF06-14 si falla la página siguiente avisa, conserva lo cargado y permite reintentar', async () => {
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockRejectedValueOnce(new NetworkError());
      listar.mockResolvedValueOnce({
        items: [movimiento({ id: 'e', descripcion: 'Mercado' })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo')).toBeOnTheScreen();
      expect(screen.getByText('Transporte')).toBeOnTheScreen();

      await fireEvent.press(screen.getByText('Reintentar'));

      expect(await screen.findByText('Mercado')).toBeOnTheScreen();
      expect(listar).toHaveBeenLastCalledWith({ hasta: hoy(), cursor: 'cursor-1' });
      expect(screen.queryByText(/No hay conexión con el servidor/)).toBeNull();
    });

    it('CA-RF06-14 ante otro fallo de la página siguiente muestra el mensaje general', async () => {
      listar.mockResolvedValueOnce(paginaConCursor);
      listar.mockRejectedValueOnce(new Error('boom'));
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      expect(
        await screen.findByText(
          'No pudimos cargar más movimientos. Inténtalo de nuevo en unos minutos.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('Almuerzo')).toBeOnTheScreen();
    });
  });

  describe('filtros Desde y Hasta', () => {
    it('CA-RF09-01 "Desde" empieza vacío y "Hasta" con una fecha', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      expect(screen.getByLabelText('Desde: sin fecha')).toBeOnTheScreen();
      expect(screen.getByText('dd/mm/aaaa')).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Hasta: /)).toBeOnTheScreen();
      expect(screen.queryByLabelText('Hasta: sin fecha')).toBeNull();
    });

    it('CA-RF09-02 elegir "Desde" cierra el calendario y vuelve a consultar con ese filtro', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await elegirDesdeElPrimeroDelMes();

      await waitFor(() =>
        expect(listar).toHaveBeenLastCalledWith({ desde: primeroDelMes, hasta: hoy() }),
      );
      expect(listar).toHaveBeenCalledTimes(2);
      expect(screen.queryByLabelText('Mes siguiente')).toBeNull();
      expect(screen.queryByLabelText('Desde: sin fecha')).toBeNull();
    });

    it('CA-RF09-03 se puede quitar una fecha y la consulta queda sin ese límite', async () => {
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await fireEvent.press(screen.getByLabelText(/^Hasta: /));
      await fireEvent.press(screen.getByText('Quitar esta fecha'));

      await waitFor(() =>
        expect(listar).toHaveBeenLastCalledWith({ desde: undefined, hasta: undefined }),
      );
      expect(screen.getByLabelText('Hasta: sin fecha')).toBeOnTheScreen();
    });

    it('CA-RF09-04 al cambiar un filtro desaparece lo anterior mientras carga y luego solo se ve lo nuevo', async () => {
      const nueva = pendiente();
      listar.mockResolvedValueOnce(primeraPagina);
      listar.mockReturnValueOnce(nueva.promesa);
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');

      await elegirDesdeElPrimeroDelMes();

      expect(await screen.findByLabelText('Cargando tus movimientos')).toBeOnTheScreen();
      expect(screen.queryByText('Almuerzo')).toBeNull();

      await act(async () =>
        nueva.resolver({
          items: [movimiento({ id: 'z', descripcion: 'Solo del filtro' })],
          siguienteCursor: null,
        }),
      );

      expect(await screen.findByText('Solo del filtro')).toBeOnTheScreen();
      expect(screen.queryByText('Almuerzo')).toBeNull();
    });

    it('CA-RF09-05 la primera página tardía de un filtro anterior no pisa el resultado del vigente', async () => {
      const vieja = pendiente();
      listar.mockReturnValueOnce(vieja.promesa);
      listar.mockResolvedValueOnce({
        items: [movimiento({ id: 'z', descripcion: 'Solo del filtro' })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);

      await elegirDesdeElPrimeroDelMes();
      expect(await screen.findByText('Solo del filtro')).toBeOnTheScreen();

      await act(async () => vieja.resolver(primeraPagina));

      expect(screen.getByText('Solo del filtro')).toBeOnTheScreen();
      expect(screen.queryByText('Almuerzo')).toBeNull();
    });

    it('CA-RF09-05 una página siguiente tardía de un filtro anterior no se agrega a la lista vigente', async () => {
      const tardia = pendiente();
      listar.mockResolvedValueOnce({
        items: primeraPagina.items.slice(0, 2),
        siguienteCursor: 'cursor-1',
      });
      listar.mockReturnValueOnce(tardia.promesa);
      listar.mockResolvedValueOnce({
        items: [movimiento({ id: 'z', descripcion: 'Solo del filtro' })],
        siguienteCursor: null,
      });
      await render(<Movimientos />);
      await screen.findByText('Almuerzo');
      await fireEvent(screen.getByTestId('lista-movimientos'), 'endReached');

      await elegirDesdeElPrimeroDelMes();
      expect(await screen.findByText('Solo del filtro')).toBeOnTheScreen();

      await act(async () =>
        tardia.resolver({
          items: [movimiento({ id: 'e', descripcion: 'Mercado' })],
          siguienteCursor: null,
        }),
      );

      expect(screen.getByText('Solo del filtro')).toBeOnTheScreen();
      expect(screen.queryByText('Mercado')).toBeNull();
    });
  });
});
