import Cargos from '@/app/tarjetas/[id]/cargos';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarCargo,
  crearCargo,
  eliminarCargo,
  listarCargos,
  type CargoFijo,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  crearServidorDeCargos,
  GIMNASIO,
  NETFLIX,
  SPOTIFY,
  VISA_ID,
} from './ayudas/datos-tarjetas';
import {
  boton,
  interruptor,
  pendiente,
  RED,
  TECNICO,
  textoDePantalla,
  textosEnOrden,
} from './ayudas/tarjetas';

// Pantalla "Cargos fijos" de una tarjeta: la lista y cómo se abre el formulario (criterios/05-tarjetas-pantallas.md,
// CA-RF29-F01 a F12, F39 a F41). El backend se simula en el borde del adaptador (lib/api/tarjetas).
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: { id?: string; nombre?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/api/tarjetas', () => ({
  listarCargos: jest.fn(),
  crearCargo: jest.fn(),
  actualizarCargo: jest.fn(),
  eliminarCargo: jest.fn(),
}));

const listar = jest.mocked(listarCargos);
const crear = jest.mocked(crearCargo);
const actualizar = jest.mocked(actualizarCargo);
const eliminar = jest.mocked(eliminarCargo);

const TEXTO = {
  cargando: 'Cargando tus cargos fijos',
  errorCarga: 'No pudimos cargar los cargos fijos. Inténtalo de nuevo en unos minutos.',
  vacio:
    'Esta tarjeta no tiene cargos fijos. Agrega los que te cobran cada mes, como una suscripción.',
  yaNoExiste: 'Esta tarjeta ya no existe.',
};

const agregar = () => boton('+ Agregar cargo fijo');
const hayAgregar = () => screen.queryByRole('button', { name: '+ Agregar cargo fijo' }) !== null;
const fila = (c: CargoFijo, valor: string) => boton(`${c.descripcion}, $ ${valor} al mes`);
const campoDescripcion = () => screen.getByLabelText('Descripción');
const campoValor = () => screen.getByLabelText('Monto en pesos');

async function mostrar(cargos: CargoFijo[] = [NETFLIX, SPOTIFY, GIMNASIO]) {
  const servidor = crearServidorDeCargos(cargos);
  listar.mockImplementation(servidor.listar);
  await render(<Cargos />);
  await screen.findByRole('button', { name: '+ Agregar cargo fijo' });
  return servidor;
}
async function abrirNuevo() {
  await mostrar();
  await fireEvent.press(agregar());
  await screen.findByText('Nuevo cargo fijo');
}
async function abrirEdicion() {
  await mostrar();
  await fireEvent.press(fila(NETFLIX, '45.000'));
  await screen.findByText('Editar cargo fijo');
}
function sinLista() {
  const texto = textoDePantalla();
  expect(texto).not.toContain('ACTIVOS ESTE MES');
  expect(texto).not.toContain('INACTIVOS');
  expect(hayAgregar()).toBe(false);
  expect(screen.queryByText(TEXTO.vacio)).toBeNull();
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockParams = { id: VISA_ID, nombre: 'Visa Bancolombia' };
  listar.mockReset().mockResolvedValue([]);
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Cargos fijos: título y carga', () => {
  it('CA-RF29-F01 muestra el nombre de la tarjeta como título, "Cargos fijos" y "Volver" regresa a la lista de tarjetas', async () => {
    await mostrar();

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos')).toBeOnTheScreen();
    await fireEvent.press(boton('Volver'));

    const regresa =
      mockBack.mock.calls.length === 1 ||
      mockReplace.mock.calls.some(([ruta]) => ruta === '/tarjetas');
    expect(regresa).toBe(true);
  });

  it('CA-RF29-F01 si la pantalla se abre sin nombre, el título es solo "Cargos fijos"', async () => {
    mockParams = { id: VISA_ID };

    await mostrar();

    expect(screen.getAllByText('Cargos fijos')).toHaveLength(1);
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(boton('Volver')).toBeOnTheScreen();
  });

  it('CA-RF29-F02 al entrar pide los cargos de la tarjeta una sola vez, sin filtro, y no envía nada más', async () => {
    await mostrar();

    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(VISA_ID);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F03 mientras carga solo se ve el título y el indicador, sin secciones, botón, aviso de vacío ni errores', async () => {
    const carga = pendiente<CargoFijo[]>();
    listar.mockReturnValueOnce(carga.promesa);

    await render(<Cargos />);

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    sinLista();
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => carga.resolver([NETFLIX]));

    expect(await screen.findByRole('button', { name: '+ Agregar cargo fijo' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();
  });

  it('CA-RF29-F04 si la consulta falla avisa, no muestra la lista y "Reintentar" vuelve a consultar la misma tarjeta', async () => {
    const segunda = pendiente<CargoFijo[]>();
    listar.mockRejectedValueOnce(new ApiError(500, 'x')).mockReturnValueOnce(segunda.promesa);
    await render(<Cargos />);

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
    sinLista();

    await fireEvent.press(boton('Reintentar'));

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(listar).toHaveBeenLastCalledWith(VISA_ID);

    await act(async () => segunda.resolver([NETFLIX]));

    expect(await screen.findByText(/Netflix/)).toBeOnTheScreen();
  });

  it('CA-RF29-F05 sin conexión avisa con "Reintentar" y el título y "Volver" siguen visibles', async () => {
    listar.mockRejectedValueOnce(new NetworkError());
    await render(<Cargos />);

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
  });

  it('CA-RF29-F06 ante un 401 la pantalla no muestra un aviso de error propio', async () => {
    listar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await render(<Cargos />);
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('CA-RF29-F07 si la tarjeta ya no existe (404) lo avisa, sin "Reintentar" ni "+ Agregar cargo fijo", y "Volver" sigue', async () => {
    listar.mockRejectedValueOnce(new ApiError(404, 'Tarjeta no encontrada'));
    await render(<Cargos />);

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(hayAgregar()).toBe(false);
    expect(boton('Volver')).toBeOnTheScreen();
    expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();
  });
});

describe('Cargos fijos: lo que se ve según haya o no cargos', () => {
  it('CA-RF29-F08 sin cargos invita a agregar el primero, sin secciones', async () => {
    await mostrar([]);

    expect(screen.getByText(TEXTO.vacio)).toBeOnTheScreen();
    expect(agregar()).toBeOnTheScreen();
    const texto = textoDePantalla();
    expect(texto).not.toContain('ACTIVOS ESTE MES');
    expect(texto).not.toContain('INACTIVOS');
  });

  it('CA-RF29-F09 con cargos los separa en "ACTIVOS ESTE MES" e "INACTIVOS", con su valor al mes y en el orden recibido', async () => {
    await mostrar();

    const texto = textoDePantalla();
    const en = (s: string) => texto.indexOf(s);
    expect(en('ACTIVOS ESTE MES')).toBeGreaterThanOrEqual(0);
    expect(en('ACTIVOS ESTE MES')).toBeLessThan(en('Netflix'));
    expect(en('Netflix')).toBeLessThan(en('Spotify'));
    expect(en('Spotify')).toBeLessThan(en('INACTIVOS'));
    expect(en('INACTIVOS')).toBeLessThan(en('Gimnasio'));
    expect(en('Gimnasio')).toBeLessThan(en('+ Agregar cargo fijo'));
    expect(screen.getAllByText(/\$ 45\.000 al mes/)).toHaveLength(1);
    expect(screen.getAllByText(/\$ 25\.000 al mes/)).toHaveLength(1);
    expect(screen.getAllByText(/\$ 90\.000 al mes/)).toHaveLength(1);
    expect(screen.queryByText(TEXTO.vacio)).toBeNull();
  });

  it('CA-RF29-F09 el valor se redondea al peso solo al mostrarlo', async () => {
    await mostrar([{ ...NETFLIX, valor: 45900.5 }]);

    expect(screen.getByText(/\$ 45\.901 al mes/)).toBeOnTheScreen();
  });

  it('CA-RF29-F09 respeta el orden en que llegan dentro de cada sección', async () => {
    await mostrar([SPOTIFY, GIMNASIO, NETFLIX, { ...GIMNASIO, id: 'g2', descripcion: 'Yoga' }]);

    const texto = textoDePantalla();
    expect(texto.indexOf('Spotify')).toBeLessThan(texto.indexOf('Netflix'));
    expect(texto.indexOf('Gimnasio')).toBeLessThan(texto.indexOf('Yoga'));
  });

  it('CA-RF29-F10 si todos los cargos son activos, solo se ve "ACTIVOS ESTE MES"', async () => {
    await mostrar([NETFLIX, SPOTIFY]);

    const texto = textoDePantalla();
    expect(texto).toContain('ACTIVOS ESTE MES');
    expect(texto).not.toContain('INACTIVOS');
  });

  it('CA-RF29-F10 si todos los cargos son inactivos, solo se ve "INACTIVOS"', async () => {
    await mostrar([GIMNASIO]);

    const texto = textoDePantalla();
    expect(texto).toContain('INACTIVOS');
    expect(texto).not.toContain('ACTIVOS ESTE MES');
  });

  it.each([
    ['sin cargos', [] as CargoFijo[]],
    ['con cargos', [NETFLIX, SPOTIFY, GIMNASIO]],
  ])(
    'CA-RF29-F11 %s, "+ Agregar cargo fijo" abre la hoja "Nuevo cargo fijo" vacía y con el interruptor encendido',
    async (_caso, cargos) => {
      await mostrar(cargos);

      await fireEvent.press(agregar());

      expect(await screen.findByText('Nuevo cargo fijo')).toBeOnTheScreen();
      expect(campoDescripcion()).toHaveDisplayValue('');
      expect(campoValor()).toHaveDisplayValue('');
      expect(interruptor('Activo este mes')).toBeChecked();
    },
  );

  it('CA-RF29-F12 tocar una fila abre "Editar cargo fijo" con los datos de ese cargo, sin llamar al backend', async () => {
    await mostrar();

    await fireEvent.press(fila(GIMNASIO, '90.000'));

    expect(await screen.findByText('Editar cargo fijo')).toBeOnTheScreen();
    expect(campoDescripcion()).toHaveDisplayValue('Gimnasio');
    expect(campoValor()).toHaveDisplayValue('$ 90.000');
    expect(interruptor('Activo este mes')).not.toBeChecked();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F12 un cargo activo se abre con el interruptor encendido', async () => {
    await mostrar();

    await fireEvent.press(fila(NETFLIX, '45.000'));

    await screen.findByText('Editar cargo fijo');
    expect(campoDescripcion()).toHaveDisplayValue('Netflix');
    expect(campoValor()).toHaveDisplayValue('$ 45.000');
    expect(interruptor('Activo este mes')).toBeChecked();
  });
});

describe('Cargos fijos: accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)', () => {
  it('CA-RF29-F39 la lista se anuncia con botones: "Volver", "+ Agregar cargo fijo" y cada fila con su descripción y su valor', async () => {
    await mostrar();

    expect(boton('Volver')).toBeOnTheScreen();
    expect(agregar()).toBeOnTheScreen();
    expect(fila(NETFLIX, '45.000')).toBeOnTheScreen();
    expect(fila(SPOTIFY, '25.000')).toBeOnTheScreen();
    expect(fila(GIMNASIO, '90.000')).toBeOnTheScreen();
  });

  it('CA-RF29-F39 el aviso de error de la consulta se anuncia como alerta', async () => {
    listar.mockRejectedValueOnce(new ApiError(500, 'x'));
    await render(<Cargos />);

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
  });

  it.each([
    ['la lista', async () => mostrar()],
    ['la hoja de un cargo nuevo', abrirNuevo],
    ['la hoja de editar', abrirEdicion],
  ])(
    'CA-RF29-F40 los textos de %s son cotidianos, sin términos técnicos ni contables',
    async (_caso, abrir) => {
      await abrir();

      const texto = textosEnOrden().join(' | ');
      expect(texto).not.toMatch(TECNICO);
      expect(texto).not.toMatch(/recurrente/i);
    },
  );

  it('CA-RF29-F41 no hay ningún total: ni de activos, ni de inactivos, ni de todos', async () => {
    await mostrar();

    const texto = textoDePantalla();
    expect(texto).not.toMatch(/total/i);
    expect(texto).not.toMatch(/70\.000|115\.000|160\.000/);
  });

  it('CA-RF29-F41 cada valor se muestra tal como lo devolvió el backend, redondeado al peso solo al mostrarlo', async () => {
    await mostrar([
      { ...NETFLIX, valor: 45000.4 },
      { ...SPOTIFY, valor: 24999.6 },
    ]);

    expect(screen.getByText(/\$ 45\.000 al mes/)).toBeOnTheScreen();
    expect(screen.getByText(/\$ 25\.000 al mes/)).toBeOnTheScreen();
    expect(textoDePantalla()).not.toMatch(/total/i);
  });
});
