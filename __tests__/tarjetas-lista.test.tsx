import Tarjetas from '@/app/tarjetas';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  obtenerProyeccion,
  obtenerTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AMEX, crearServidorDeTarjetas, VISA, VISA_ID } from './ayudas/datos-tarjetas';
import { mostrarDetalle } from './ayudas/detalle-tarjeta';
import { volverAlFoco } from './ayudas/router-simulado';
import {
  boton,
  interruptor,
  laHoja,
  pendiente,
  RED,
  TECNICO,
  textoDePantalla,
  textosEnOrden,
  VER_TODO,
  volverDeLaHoja,
} from './ayudas/tarjetas';

// Pantalla "Mis tarjetas": la lista y cómo se abre el formulario (criterios/05-tarjetas-pantallas.md, CA-RF24-F03
// a F12, F48 a F51; la fila abre el detalle desde el paquete 5.3.3: criterios/05-detalle-de-tarjeta.md, CA-RF30-F01
// y F29). El formulario de editar se abre desde el detalle de la tarjeta. El backend se simula en el borde del
// adaptador (lib/api/tarjetas).
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => require('./ayudas/router-simulado').parametros,
  useFocusEffect: require('./ayudas/router-simulado').useFocusEffectSimulado,
}));
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

const listar = jest.mocked(listarTarjetas);
const crear = jest.mocked(crearTarjeta);
const actualizar = jest.mocked(actualizarTarjeta);
const eliminar = jest.mocked(eliminarTarjeta);

const TEXTO = {
  cargando: 'Cargando tus tarjetas',
  errorCarga: 'No pudimos cargar tus tarjetas. Inténtalo de nuevo en unos minutos.',
  vacio: 'Todavía no tienes tarjetas. Agrega la primera para empezar.',
  nota: 'Si cambias la tasa, aplica solo a las compras nuevas. Las anteriores conservan la que tenían.',
};

const agregar = () => boton('+ Agregar tarjeta');
const hayAgregar = () => screen.queryByRole('button', { name: '+ Agregar tarjeta' }) !== null;
const campoAlias = () => screen.getByLabelText('Alias');
const campoTasa = () => screen.getByLabelText('Tasa de interés E.A.');
const filaDe = (t: Tarjeta, tasa: string) => boton(`${t.nombre}, Tasa ${tasa} % E.A.`);

async function mostrar(tarjetas: Tarjeta[] = [VISA, AMEX]) {
  const servidor = crearServidorDeTarjetas(tarjetas);
  listar.mockImplementation(servidor.listar);
  await render(<Tarjetas />);
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
  return servidor;
}
/** El formulario de editar se abre desde el detalle de la tarjeta (botón "Editar tarjeta"). */
async function abrirEdicion() {
  await mostrarDetalle({ servidor: crearServidorDeTarjetas([VISA, AMEX]) });
  await fireEvent.press(boton('Editar tarjeta'));
  await screen.findByText('Guardar tarjeta');
}
const hojaAbierta = () => screen.queryByLabelText('Alias', VER_TODO) !== null;
async function abrirNueva() {
  await mostrar();
  await fireEvent.press(agregar());
  await screen.findByText('Nueva tarjeta');
}
function sinLista() {
  expect(screen.queryByText(/^Tasa /)).toBeNull();
  expect(hayAgregar()).toBe(false);
  expect(screen.queryByText(TEXTO.vacio)).toBeNull();
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  listar.mockReset().mockResolvedValue([]);
  jest.mocked(obtenerTarjeta).mockReset();
  jest.mocked(obtenerProyeccion).mockReset();
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Mis tarjetas: título y carga', () => {
  it('CA-RF24-F03 muestra el título "Mis tarjetas" y "Volver" regresa a la pantalla anterior', async () => {
    await mostrar();

    expect(screen.getByText('Mis tarjetas')).toBeOnTheScreen();
    await fireEvent.press(boton('Volver'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('CA-RF24-F04 al entrar pide las tarjetas una sola vez y no envía nada más', async () => {
    await mostrar();

    expect(listar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F05 mientras carga solo se ve el título y el indicador, sin lista, botón, aviso de vacío ni errores', async () => {
    const carga = pendiente<Tarjeta[]>();
    listar.mockReturnValueOnce(carga.promesa);

    await render(<Tarjetas />);

    expect(screen.getByText('Mis tarjetas')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    sinLista();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();

    await act(async () => carga.resolver([VISA]));

    expect(await screen.findByRole('button', { name: '+ Agregar tarjeta' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();
  });

  it('CA-RF24-F06 si la consulta falla avisa, no muestra la lista y "Reintentar" vuelve a consultar', async () => {
    const segunda = pendiente<Tarjeta[]>();
    listar.mockRejectedValueOnce(new ApiError(500, 'x')).mockReturnValueOnce(segunda.promesa);
    await render(<Tarjetas />);

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
    sinLista();

    await fireEvent.press(boton('Reintentar'));

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(listar).toHaveBeenCalledTimes(2);

    await act(async () => segunda.resolver([VISA]));

    expect(await screen.findByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
  });

  it('CA-RF24-F07 sin conexión avisa con "Reintentar" y el título y "Volver" siguen visibles', async () => {
    listar.mockRejectedValueOnce(new NetworkError());
    await render(<Tarjetas />);

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(screen.getByText('Mis tarjetas')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
  });

  it('CA-RF24-F08 ante un 401 la pantalla no muestra un aviso de error propio', async () => {
    listar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await render(<Tarjetas />);
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(screen.queryByText(RED)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});

describe('Mis tarjetas: lo que se ve según haya o no tarjetas', () => {
  it('CA-RF24-F09 sin tarjetas invita a agregar la primera y no muestra filas ni errores', async () => {
    await mostrar([]);

    expect(screen.getByText(TEXTO.vacio)).toBeOnTheScreen();
    expect(agregar()).toBeOnTheScreen();
    expect(screen.queryByText(/^Tasa /)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF24-F10 con tarjetas muestra una fila por tarjeta con su nombre y su tasa, y al final "+ Agregar tarjeta"', async () => {
    await mostrar([AMEX, VISA]);

    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 24,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    const texto = textoDePantalla();
    expect(texto.indexOf('Amex')).toBeLessThan(texto.indexOf('Visa Bancolombia'));
    expect(texto.indexOf('Visa Bancolombia')).toBeLessThan(texto.indexOf('+ Agregar tarjeta'));
    // Desde el paquete 5.2.4: debajo de "+ Agregar tarjeta" está el botón del avance en efectivo (CA-RF28-F01)
    expect(boton('Avance en efectivo')).toBeOnTheScreen();
    expect(texto.indexOf('+ Agregar tarjeta')).toBeLessThan(texto.indexOf('Avance en efectivo'));
    expect(screen.queryByText(TEXTO.vacio)).toBeNull();
  });

  it('CA-RF24-F10 conserva el orden en que llegan las tarjetas, sin reordenarlas', async () => {
    listar.mockResolvedValue([{ ...VISA }, { ...AMEX }]);
    await render(<Tarjetas />);
    await screen.findByText('Amex');

    const texto = textoDePantalla();
    expect(texto.indexOf('Visa Bancolombia')).toBeLessThan(texto.indexOf('Amex'));
  });

  it('CA-RF24-F10 no muestra deuda, corte ni pago (la API no tiene esos datos)', async () => {
    await mostrar();

    expect(textoDePantalla()).not.toMatch(/deuda|corte|pago|cupo|\$/i);
  });

  it('CA-RF24-F11 la tasa de cada fila se muestra con coma decimal y sin ceros ni decimales de más', async () => {
    const tasas: [number, string][] = [
      [0.24, 'Tasa 24 % E.A.'],
      [0.2921, 'Tasa 29,21 % E.A.'],
      [0.083, 'Tasa 8,3 % E.A.'],
      [0.07, 'Tasa 7 % E.A.'],
      [0.57, 'Tasa 57 % E.A.'],
      [0, 'Tasa 0 % E.A.'],
      [1, 'Tasa 100 % E.A.'],
    ];
    await mostrar(
      tasas.map(([tasaEA], i) => ({ ...VISA, id: `t${i}`, nombre: `Tarjeta ${i}`, tasaEA })),
    );

    tasas.forEach(([, texto]) => expect(screen.getByText(texto)).toBeOnTheScreen());
    expect(textoDePantalla()).not.toMatch(/\d,\d{4,}/);
  });

  it.each([
    ['sin tarjetas', [] as Tarjeta[]],
    ['con tarjetas', [VISA, AMEX]],
  ])(
    'CA-RF24-F12 %s, "+ Agregar tarjeta" abre la hoja "Nueva tarjeta" vacía',
    async (_caso, tarjetas) => {
      await mostrar(tarjetas);

      await fireEvent.press(agregar());

      expect(await screen.findByText('Nueva tarjeta')).toBeOnTheScreen();
      expect(campoAlias()).toHaveDisplayValue('');
      expect(campoTasa()).toHaveDisplayValue('');
      expect(interruptor('Compras a 1 cuota sin intereses')).not.toBeChecked();
    },
  );

  it.each([
    ['Visa Bancolombia', VISA, '29,21'],
    ['Amex', AMEX, '24,21'],
  ])(
    'CA-RF30-F01 tocar la fila "%s" abre el detalle de esa tarjeta, una sola vez, sin abrir la hoja ni llamar al backend',
    async (_nombre, tarjeta, tasa) => {
      await mostrar();

      await fireEvent.press(filaDe(tarjeta, tasa));

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/tarjetas/[id]',
        params: { id: tarjeta.id, nombre: tarjeta.nombre },
      });
      expect(screen.queryByText('Editar tarjeta', VER_TODO)).toBeNull();
      expect(hojaAbierta()).toBe(false);
      expect(listar).toHaveBeenCalledTimes(1);
      expect(obtenerTarjeta).not.toHaveBeenCalled();
      expect(obtenerProyeccion).not.toHaveBeenCalled();
      expect(crear).not.toHaveBeenCalled();
      expect(actualizar).not.toHaveBeenCalled();
      expect(eliminar).not.toHaveBeenCalled();
    },
  );

  it('CA-RF30-F01 "+ Agregar tarjeta" sigue abriendo la hoja "Nueva tarjeta" sobre la lista, sin navegar', async () => {
    await mostrar();

    await fireEvent.press(agregar());

    expect(await screen.findByText('Nueva tarjeta')).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Mis tarjetas: al volver de un detalle (la pantalla recupera el foco)', () => {
  it('CA-RF30-F29 vuelve a pedir la lista y muestra el nombre y la tasa nuevos, sin duplicar la fila', async () => {
    const servidor = await mostrar();
    expect(listar).toHaveBeenCalledTimes(1);
    await servidor.actualizar(VISA_ID, { nombre: 'Visa Oro', tasaEA: 0.315 });

    await volverAlFoco();

    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Visa Oro')).toHaveLength(1);
    expect(screen.getByText('Tasa 31,5 % E.A.')).toBeOnTheScreen();
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(screen.queryByText('Tasa 29,21 % E.A.')).toBeNull();
    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(screen.getAllByText(/^Tasa /)).toHaveLength(2);
  });

  it('CA-RF30-F29 la tarjeta eliminada ya no aparece al volver', async () => {
    const servidor = await mostrar();
    await servidor.eliminar(VISA_ID);

    await volverAlFoco();

    await waitFor(() => expect(screen.queryByText('Visa Bancolombia')).toBeNull());
    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Amex')).toBeOnTheScreen();
  });

  it('CA-RF30-F29 si era la última tarjeta, al volver se ve el aviso de vacío', async () => {
    const servidor = await mostrar([VISA]);
    await servidor.eliminar(VISA_ID);

    await volverAlFoco();

    expect(await screen.findByText(TEXTO.vacio)).toBeOnTheScreen();
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(screen.queryByText(/^Tasa /)).toBeNull();
  });

  it('CA-RF30-F29 mientras se vuelve a pedir se siguen viendo las filas que ya estaban, sin indicador de carga', async () => {
    await mostrar();
    const nueva = pendiente<Tarjeta[]>();
    listar.mockReturnValueOnce(nueva.promesa);

    await volverAlFoco();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();

    await act(async () => nueva.resolver([{ ...AMEX }]));

    await waitFor(() => expect(screen.queryByText('Visa Bancolombia')).toBeNull());
    expect(screen.getByText('Amex')).toBeOnTheScreen();
  });
});

describe('Mis tarjetas: ir a los cargos fijos', () => {
  it('CA-RF24-F48 "Cargos fijos" cierra la hoja y navega a la pantalla de esa tarjeta con su nombre, sin enviar nada', async () => {
    await abrirEdicion();
    await fireEvent.changeText(campoAlias(), 'Otro alias');

    await fireEvent.press(boton('Cargos fijos'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/tarjetas/[id]/cargos',
      params: { id: VISA_ID, nombre: 'Visa Bancolombia' },
    });
    await waitFor(() => expect(hojaAbierta()).toBe(false));
    expect(actualizar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F48 lo escrito en el formulario se descarta: al volver a abrir la tarjeta se ve el alias guardado', async () => {
    await abrirEdicion();
    await fireEvent.changeText(campoAlias(), 'Otro alias');
    await fireEvent.press(boton('Cargos fijos'));
    await waitFor(() => expect(hojaAbierta()).toBe(false));

    // Al volver a abrir la hoja desde el detalle, se ve el alias guardado
    await fireEvent.press(boton('Editar tarjeta'));

    await screen.findByText('Guardar tarjeta');
    expect(campoAlias()).toHaveDisplayValue('Visa Bancolombia');
  });
});

describe('Mis tarjetas: accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)', () => {
  it('CA-RF24-F49 la lista se anuncia con botones: "Volver", "+ Agregar tarjeta" y cada fila con su nombre y su tasa', async () => {
    await mostrar();

    expect(boton('Volver')).toBeOnTheScreen();
    expect(agregar()).toBeOnTheScreen();
    expect(filaDe(VISA, '29,21')).toBeOnTheScreen();
    expect(filaDe(AMEX, '24,21')).toBeOnTheScreen();
  });

  it('CA-RF24-F49 el formulario de una tarjeta nueva se anuncia con sus botones, campos e interruptor', async () => {
    await abrirNueva();

    expect(volverDeLaHoja('Nueva tarjeta')).toBeOnTheScreen();
    expect(boton('Guardar tarjeta')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alias')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tasa de interés E.A.')).toBeOnTheScreen();
    expect(
      screen.getByRole('switch', { name: 'Compras a 1 cuota sin intereses' }),
    ).toBeOnTheScreen();
  });

  it('CA-RF24-F49 el formulario de editar suma "Cargos fijos" y "Eliminar tarjeta" como botones y el interruptor con su estado', async () => {
    await abrirEdicion();

    expect(volverDeLaHoja('Editar tarjeta')).toBeOnTheScreen();
    expect(boton('Guardar tarjeta')).toBeOnTheScreen();
    expect(boton('Cargos fijos')).toBeOnTheScreen();
    expect(boton('Eliminar tarjeta')).toBeOnTheScreen();
    expect(interruptor('Compras a 1 cuota sin intereses')).toBeChecked();
  });

  it('CA-RF24-F49 el aviso de error de la consulta se anuncia como alerta', async () => {
    listar.mockRejectedValueOnce(new ApiError(500, 'x'));
    await render(<Tarjetas />);

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
  });

  it.each([
    ['la lista', async () => mostrar()],
    ['la hoja de una tarjeta nueva', abrirNueva],
    ['la hoja de editar', abrirEdicion],
  ])(
    'CA-RF24-F50 los textos de %s son cotidianos, sin términos técnicos ni contables',
    async (_caso, abrir) => {
      await abrir();

      const texto = textosEnOrden().join(' | ');
      expect(texto).not.toMatch(TECNICO);
      expect(texto).not.toMatch(/\bnombre\b/i);
    },
  );

  it('CA-RF24-F50 la hoja de editar dice "Alias" y "Tasa de interés E.A.", con la nota de la tasa en lenguaje cotidiano', async () => {
    await abrirEdicion();

    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos')).toBeOnTheScreen();
    expect(screen.getByText('Eliminar tarjeta')).toBeOnTheScreen();
    expect(screen.queryByText(/Cupo|Día de corte|Día de pago/)).toBeNull();
  });

  it('CA-RF24-F51 la lista y los formularios no calculan ni muestran ningún monto en pesos', async () => {
    await mostrar();
    expect(textosEnOrden().join(' ')).not.toContain('$');
    await screen.unmount();

    // El formulario de editar se abre desde el detalle, que sí muestra montos del backend: se mira solo la hoja
    await abrirEdicion();

    expect(laHoja().queryByText(/\$/)).toBeNull();
    expect(laHoja().queryByText(/deuda|cuota estimada|total/i)).toBeNull();
  });
});
