import MetaDeAhorro from '@/app/meta-de-ahorro';
import {
  actualizarMeta,
  crearMeta,
  eliminarMeta,
  obtenerMetaDelMes,
  obtenerProgresoAhorro,
  type MetaAhorro,
  type ProgresoAhorro,
} from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Pantalla "Meta de ahorro" (criterios/04-ahorro-meta.md, CA-RF21-F03 a F45). El backend se simula en el borde del
// adaptador (lib/api/ahorro). Hoy es el 17 de septiembre de 2026 (reloj simulado): el mes actual es 2026-09.
const mockBack = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/lib/api/ahorro', () => ({
  obtenerMetaDelMes: jest.fn(),
  obtenerProgresoAhorro: jest.fn(),
  crearMeta: jest.fn(),
  actualizarMeta: jest.fn(),
  eliminarMeta: jest.fn(),
}));

const obtener = jest.mocked(obtenerMetaDelMes);
const progreso = jest.mocked(obtenerProgresoAhorro);
const crear = jest.mocked(crearMeta);
const actualizar = jest.mocked(actualizarMeta);
const eliminar = jest.mocked(eliminarMeta);

const BASE = {
  periodo: '2026-09',
  ahorroReal: 0,
  creadaEn: '2026-09-01T10:00:00.000Z',
  actualizadaEn: '2026-09-01T10:00:00.000Z',
};
const META_MONTO: MetaAhorro = {
  ...BASE,
  id: 'm1',
  tipoMeta: 'MONTO_FIJO',
  valorObjetivo: 1500000,
};
const META_PORCENTAJE: MetaAhorro = {
  ...BASE,
  id: 'm2',
  tipoMeta: 'PORCENTAJE',
  valorObjetivo: 12.5,
};

// Mismo formato que valida el backend para Idempotency-Key
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TEXTO = {
  cargando: 'Cargando tu meta de ahorro',
  errorCarga: 'No pudimos cargar tu meta de ahorro. Inténtalo de nuevo en unos minutos.',
  red: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  montoVacio: 'Escribe un monto mayor que cero.',
  porcentajeVacio: 'Escribe un porcentaje mayor que 0.',
  porcentajeAlto: 'El porcentaje no puede pasar de 100.',
  guardada: 'Meta guardada.',
  quitada: 'Meta quitada.',
  yaExiste: 'Ya tienes una meta para este mes. Te mostramos la que está guardada.',
  yaNoExiste: 'Esta meta ya no existe. Vuelve a guardarla para crearla de nuevo.',
  errorGuardar: 'No pudimos guardar tu meta. Revisa el valor e inténtalo de nuevo.',
  conAhorro: 'Esta meta ya tiene ahorro registrado y no se puede quitar.',
  errorQuitar: 'No pudimos quitar tu meta. Inténtalo de nuevo en unos minutos.',
  nota: 'Esta meta es para septiembre de 2026. Cada mes puedes fijar la tuya.',
  ayudaMonto:
    'Es lo que quieres que te quede cada mes después de restar tus egresos a tus ingresos.',
  ayudaPorcentaje:
    'Es la parte de tus ingresos que quieres que te quede cada mes, después de restar tus egresos.',
  dialogo: '¿Quitar tu meta de ahorro?',
  dialogoDetalle: 'Se quitará la meta de septiembre de 2026. Esta acción no se puede deshacer.',
};
// Todos los avisos de error y de validación (el aviso de éxito no cuenta)
const AVISOS_DE_ERROR = [
  TEXTO.errorCarga,
  TEXTO.red,
  TEXTO.montoVacio,
  TEXTO.porcentajeVacio,
  TEXTO.porcentajeAlto,
  TEXTO.yaNoExiste,
  TEXTO.errorGuardar,
  TEXTO.conAhorro,
  TEXTO.errorQuitar,
];

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

/** Todos los textos visibles, en el orden en que aparecen en pantalla. */
function textosEnOrden(nodo: unknown = screen.toJSON(), acumulado: string[] = []): string[] {
  if (typeof nodo === 'string') acumulado.push(nodo);
  else if (Array.isArray(nodo)) nodo.forEach((n) => textosEnOrden(n, acumulado));
  else if (nodo && typeof nodo === 'object' && 'children' in nodo) {
    textosEnOrden((nodo as { children: unknown }).children, acumulado);
  }
  return acumulado;
}

const boton = (nombre: string, opciones = {}) =>
  screen.getByRole('button', { name: nombre, ...opciones });
const tipoMonto = () => boton('Monto');
const tipoPorcentaje = () => boton('Porcentaje');
const campoMonto = () => screen.getByLabelText('Monto en pesos');
const campoPorcentaje = () => screen.getByLabelText('Porcentaje de tus ingresos');
const guardar = () => boton('Guardar meta');
const hayQuitar = () => screen.queryByRole('button', { name: 'Quitar meta' }) !== null;
const dialogoAbierto = () => screen.queryByText(TEXTO.dialogo) !== null;

async function mostrar(meta: MetaAhorro | null = null) {
  obtener.mockResolvedValue(meta);
  await render(<MetaDeAhorro />);
  await screen.findByRole('button', { name: 'Guardar meta' });
}
async function escribirMonto(texto: string) {
  await fireEvent.changeText(campoMonto(), texto);
}
async function escribirPorcentaje(texto: string) {
  await fireEvent.changeText(campoPorcentaje(), texto);
}
async function elegirPorcentaje() {
  await fireEvent.press(tipoPorcentaje());
}
async function tocarGuardar() {
  await fireEvent.press(guardar());
}
async function abrirDialogo(meta: MetaAhorro = META_MONTO) {
  await mostrar(meta);
  await fireEvent.press(boton('Quitar meta'));
  await screen.findByText(TEXTO.dialogo);
}
function sinAvisosDeError() {
  AVISOS_DE_ERROR.forEach((aviso) => expect(screen.queryByText(aviso)).toBeNull());
}
/** Ningún aviso de error ni alerta: el aviso de éxito no cuenta como error, pero podría anunciarse como alerta. */
function sinAlertas() {
  sinAvisosDeError();
  expect(screen.queryByRole('alert')).toBeNull();
}

// Solo se congela la fecha, con una fecha local (no depende de la zona de la máquina)
const NO_FALSEAR = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 17, 12), doNotFake: [...NO_FALSEAR] });
  mockBack.mockClear();
  obtener.mockReset().mockResolvedValue(null);
  // La tarjeta de progreso (paquete 4.3.2) tiene sus propias pruebas (meta-de-ahorro-progreso.test.tsx): aquí se
  // queda cargando, para que estas pruebas sigan hablando solo del formulario (CA-RF22, efecto en CA-RF21-F05/F12).
  progreso.mockReset().mockReturnValue(new Promise<ProgresoAhorro>(() => {}));
  crear
    .mockReset()
    .mockImplementation(async (datos) => ({ ...BASE, id: 'creada-1', ...datos }) as MetaAhorro);
  actualizar
    .mockReset()
    .mockImplementation(async (id, datos) => ({ ...BASE, id, ...datos }) as MetaAhorro);
  eliminar.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Meta de ahorro: entrada y carga', () => {
  it('CA-RF21-F03 muestra el título "Meta de ahorro" y "Volver" regresa a la pantalla anterior', async () => {
    await mostrar();

    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    await fireEvent.press(boton('Volver'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F04 al entrar consulta una sola vez la meta del mes actual y no envía nada más', async () => {
    await mostrar();

    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener).toHaveBeenCalledWith('2026-09');
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F05 mientras carga solo se ve el título y el indicador, sin formulario ni botones ni avisos', async () => {
    const carga = pendiente<MetaAhorro | null>();
    obtener.mockReturnValueOnce(carga.promesa);

    await render(<MetaDeAhorro />);

    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    // La tarjeta de progreso tiene su propio indicador ("Cargando tu progreso de ahorro", CA-RF22-F15): el de la
    // meta se busca por su nombre, sin asumir que hay uno solo
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.getByLabelText('Cargando tu progreso de ahorro')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Guardar meta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar meta' })).toBeNull();
    expect(screen.queryByLabelText('Monto en pesos')).toBeNull();
    expect(screen.queryByLabelText('Porcentaje de tus ingresos')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    sinAvisosDeError();

    await act(async () => carga.resolver(null));

    expect(await screen.findByRole('button', { name: 'Guardar meta' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();
  });

  it('CA-RF21-F06 si la consulta falla avisa, no muestra el formulario y "Reintentar" vuelve a consultar el mismo mes', async () => {
    const segunda = pendiente<MetaAhorro | null>();
    obtener.mockRejectedValueOnce(new ApiError(500, 'x')).mockReturnValueOnce(segunda.promesa);
    await render(<MetaDeAhorro />);

    expect(await screen.findByText(TEXTO.errorCarga)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Guardar meta' })).toBeNull();
    expect(screen.queryByLabelText('Monto en pesos')).toBeNull();

    await fireEvent.press(boton('Reintentar'));

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.errorCarga)).toBeNull();
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener).toHaveBeenLastCalledWith('2026-09');

    await act(async () => segunda.resolver(null));

    expect(await screen.findByRole('button', { name: 'Guardar meta' })).toBeOnTheScreen();
  });

  it('CA-RF21-F07 sin conexión avisa con "Reintentar" y el título y "Volver" siguen visibles', async () => {
    obtener.mockRejectedValueOnce(new NetworkError());
    await render(<MetaDeAhorro />);

    expect(await screen.findByText(TEXTO.red)).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
  });

  it('CA-RF21-F08 ante un 401 la pantalla no muestra un aviso de error propio', async () => {
    obtener.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await render(<MetaDeAhorro />);
    await waitFor(() => expect(obtener).toHaveBeenCalledTimes(1));
    await act(async () => {});

    sinAlertas();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});

describe('Meta de ahorro: lo que se ve según haya o no meta', () => {
  it('CA-RF21-F09 sin meta del mes: "Monto" elegido, campo vacío con "$ 0", "Guardar meta" y sin "Quitar meta"', async () => {
    await mostrar(null);

    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(boton('Porcentaje', { selected: false })).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('');
    expect(campoMonto().props.placeholder).toBe('$ 0');
    expect(guardar()).toBeOnTheScreen();
    expect(hayQuitar()).toBe(false);
  });

  it('CA-RF21-F10 con una meta de monto: "Monto" elegido, "$ 1.500.000", "Guardar meta" y "Quitar meta"', async () => {
    await mostrar(META_MONTO);

    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(boton('Porcentaje', { selected: false })).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
    expect(guardar()).toBeOnTheScreen();
    expect(boton('Quitar meta')).toBeOnTheScreen();
  });

  it('CA-RF21-F11 con una meta de porcentaje: "Porcentaje" elegido, "12,5" con coma, "% de tus ingresos" y los dos botones', async () => {
    await mostrar(META_PORCENTAJE);

    expect(boton('Porcentaje', { selected: true })).toBeOnTheScreen();
    expect(boton('Monto', { selected: false })).toBeOnTheScreen();
    expect(campoPorcentaje()).toHaveDisplayValue('12,5');
    expect(screen.getByText('% de tus ingresos')).toBeOnTheScreen();
    expect(guardar()).toBeOnTheScreen();
    expect(boton('Quitar meta')).toBeOnTheScreen();
  });

  it.each([
    ['sin meta', null],
    ['con una meta de monto', META_MONTO],
  ])('CA-RF21-F12 %s: textos fijos y nada de lo que todavía no existe', async (_caso, meta) => {
    await mostrar(meta);

    expect(screen.getByText('Meta mensual')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.ayudaMonto)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.ayudaPorcentaje)).toBeNull();
    const texto = textosEnOrden().join(' ');
    // La tarjeta de progreso sí aparece arriba (CA-RF22-F02 y F03); siguen sin verse estas otras cosas
    expect(texto).not.toMatch(
      /Referencia|Ingresos recurrentes|El cambio aplica desde este mes|próximamente/i,
    );
  });

  it('CA-RF21-F12 con "Porcentaje" el texto de ayuda es el del porcentaje y la nota sigue igual', async () => {
    await mostrar(META_PORCENTAJE);

    expect(screen.getByText(TEXTO.ayudaPorcentaje)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.ayudaMonto)).toBeNull();
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
  });
});

describe('Meta de ahorro: elegir el tipo y escribir el valor', () => {
  it('CA-RF21-F13 el selector cambia el campo, su etiqueta y el texto de ayuda, y se puede volver a "Monto"', async () => {
    await mostrar(null);

    await elegirPorcentaje();

    expect(boton('Porcentaje', { selected: true })).toBeOnTheScreen();
    expect(boton('Monto', { selected: false })).toBeOnTheScreen();
    expect(campoPorcentaje()).toBeOnTheScreen();
    expect(screen.queryByLabelText('Monto en pesos')).toBeNull();
    expect(screen.getByText('% de tus ingresos')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.ayudaPorcentaje)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.ayudaMonto)).toBeNull();

    await fireEvent.press(tipoMonto());

    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(campoMonto()).toBeOnTheScreen();
    expect(screen.queryByLabelText('Porcentaje de tus ingresos')).toBeNull();
    expect(screen.getByText(TEXTO.ayudaMonto)).toBeOnTheScreen();
  });

  it('CA-RF21-F14 cada tipo recuerda su valor y el otro arranca vacío (el monto no se convierte en porcentaje)', async () => {
    await mostrar(null);
    await escribirMonto('1500000');
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');

    await elegirPorcentaje();
    expect(campoPorcentaje()).toHaveDisplayValue('');
    await escribirPorcentaje('20');
    await fireEvent.press(tipoMonto());

    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');

    await elegirPorcentaje();

    expect(campoPorcentaje()).toHaveDisplayValue('20');
  });

  it.each(['1500000', '1.500.000', 'abc1500000'])(
    'CA-RF21-F15 el campo de monto muestra "$ 1.500.000" al escribir "%s"',
    async (texto) => {
      await mostrar(null);

      await escribirMonto(texto);

      expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
    },
  );

  it('CA-RF21-F15 el campo de monto no acepta negativos, deja vacío el cero y tiene un tope de 12 dígitos', async () => {
    await mostrar(null);

    await escribirMonto('-500');
    expect(campoMonto()).toHaveDisplayValue('$ 500');

    await escribirMonto('0');
    expect(campoMonto()).toHaveDisplayValue('');

    await escribirMonto('1234567890123');
    expect(campoMonto()).toHaveDisplayValue('$ 123.456.789.012');
  });

  it.each(['12,5', '12.5', 'abc12,5'])(
    'CA-RF21-F16 el campo de porcentaje muestra "12,5" al escribir "%s"',
    async (texto) => {
      await mostrar(null);
      await elegirPorcentaje();

      await escribirPorcentaje(texto);

      expect(campoPorcentaje()).toHaveDisplayValue('12,5');
    },
  );

  it.each(['12,555', '12.555'])(
    'CA-RF21-F16 el campo de porcentaje conserva solo dos decimales al escribir "%s"',
    async (texto) => {
      await mostrar(null);
      await elegirPorcentaje();

      await escribirPorcentaje(texto);

      expect(campoPorcentaje()).toHaveDisplayValue('12,55');
    },
  );

  it('CA-RF21-F16 el campo de porcentaje no admite un segundo separador decimal', async () => {
    await mostrar(null);
    await elegirPorcentaje();
    await escribirPorcentaje('1,2');

    await escribirPorcentaje('1,2,');

    expect(campoPorcentaje()).toHaveDisplayValue(/^\d+,\d{1,2}$/);
  });
});

describe('Meta de ahorro: validación antes de llamar al backend', () => {
  it.each([
    ['vacío', ''],
    ['en cero', '0'],
  ])('CA-RF21-F17 un monto %s no se envía y avisa', async (_caso, texto) => {
    await mostrar(null);
    await escribirMonto(texto);

    await tocarGuardar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.montoVacio);
    expect(campoMonto()).toHaveDisplayValue('');
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F17 con una meta guardada, dejar el monto vacío tampoco se envía para editar', async () => {
    await mostrar(META_MONTO);
    await escribirMonto('');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.montoVacio)).toBeOnTheScreen();
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it.each(['', '0', '0,0', ','])(
    'CA-RF21-F18 un porcentaje "%s" no se envía y avisa',
    async (texto) => {
      await mostrar(null);
      await elegirPorcentaje();
      await escribirPorcentaje(texto);

      await tocarGuardar();

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.porcentajeVacio);
      expect(crear).not.toHaveBeenCalled();
      expect(actualizar).not.toHaveBeenCalled();
    },
  );

  it.each(['100,5', '150'])(
    'CA-RF21-F19 un porcentaje de "%s" no se envía y avisa',
    async (texto) => {
      await mostrar(null);
      await elegirPorcentaje();
      await escribirPorcentaje(texto);

      await tocarGuardar();

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.porcentajeAlto);
      expect(crear).not.toHaveBeenCalled();
      expect(actualizar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['100', 100],
    ['0,5', 0.5],
  ])('CA-RF21-F19 el extremo válido "%s" sí se envía', async (texto, valor) => {
    await mostrar(null);
    await elegirPorcentaje();
    await escribirPorcentaje(texto);

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({
      tipoMeta: 'PORCENTAJE',
      valorObjetivo: valor,
      periodo: '2026-09',
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF21-F20 el aviso de validación desaparece al editar el campo', async () => {
    await mostrar(null);
    await tocarGuardar();
    await screen.findByText(TEXTO.montoVacio);

    await escribirMonto('1500000');

    expect(screen.queryByText(TEXTO.montoVacio)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF21-F20 el aviso de validación desaparece al cambiar el tipo', async () => {
    await mostrar(null);
    await tocarGuardar();
    await screen.findByText(TEXTO.montoVacio);

    await elegirPorcentaje();

    expect(screen.queryByText(TEXTO.montoVacio)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Meta de ahorro: guardar', () => {
  it('CA-RF21-F21 sin meta, "Guardar meta" crea con el cuerpo exacto, una clave UUID y nada más', async () => {
    await mostrar(null);
    await escribirMonto('1500000');

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear).toHaveBeenCalledWith(
      { tipoMeta: 'MONTO_FIJO', valorObjetivo: 1500000, periodo: '2026-09' },
      expect.any(String),
    );
    expect(Object.keys(crear.mock.calls[0][0]).sort()).toEqual([
      'periodo',
      'tipoMeta',
      'valorObjetivo',
    ]);
    expect(crear.mock.calls[0][1]).toMatch(UUID);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F21 con "Porcentaje" y "12,5" envía el porcentaje como número', async () => {
    await mostrar(null);
    await elegirPorcentaje();
    await escribirPorcentaje('12,5');

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    const cuerpo = crear.mock.calls[0][0];
    expect(cuerpo).toEqual({ tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5, periodo: '2026-09' });
    expect(typeof cuerpo.valorObjetivo).toBe('number');
    expect(cuerpo).not.toHaveProperty('ahorroReal');
  });

  it('CA-RF21-F22 al crear, la pantalla muestra lo que devolvió el backend con "Meta guardada." y no consulta de nuevo', async () => {
    crear.mockResolvedValueOnce({ ...META_MONTO, id: 'm9', valorObjetivo: 1234000 });
    await mostrar(null);
    await escribirMonto('1234567');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.234.000');
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
    sinAvisosDeError();
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F22 al crear con porcentaje, se ve el tipo y el valor que devolvió el backend', async () => {
    crear.mockResolvedValueOnce({ ...META_PORCENTAJE, id: 'm9', valorObjetivo: 12.6 });
    await mostrar(null);
    await elegirPorcentaje();
    await escribirPorcentaje('12,555');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(boton('Porcentaje', { selected: true })).toBeOnTheScreen();
    expect(campoPorcentaje()).toHaveDisplayValue('12,6');
  });

  it('CA-RF21-F22 al editar, la pantalla muestra lo que devolvió el backend con "Meta guardada." y no consulta de nuevo', async () => {
    actualizar.mockResolvedValueOnce({ ...META_MONTO, valorObjetivo: 1800500 });
    await mostrar(META_MONTO);
    await escribirMonto('1800000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.800.500');
    expect(boton('Quitar meta')).toBeOnTheScreen();
    sinAvisosDeError();
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F22 "Meta guardada." se queda hasta que el usuario edita el campo', async () => {
    await mostrar(null);
    await escribirMonto('1500000');
    await tocarGuardar();
    await screen.findByText(TEXTO.guardada);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(TEXTO.guardada)).toBeOnTheScreen();

    await escribirMonto('1800000');

    expect(screen.queryByText(TEXTO.guardada)).toBeNull();
  });

  it('CA-RF21-F22 "Meta guardada." desaparece al cambiar el tipo', async () => {
    await mostrar(null);
    await escribirMonto('1500000');
    await tocarGuardar();
    await screen.findByText(TEXTO.guardada);

    await elegirPorcentaje();

    expect(screen.queryByText(TEXTO.guardada)).toBeNull();
  });

  it('CA-RF21-F23 tras crear, el siguiente "Guardar meta" edita la meta creada y no crea otra', async () => {
    await mostrar(null);
    await escribirMonto('1500000');
    await tocarGuardar();
    await screen.findByText(TEXTO.guardada);

    await escribirMonto('1800000');
    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith('creada-1', {
      tipoMeta: 'MONTO_FIJO',
      valorObjetivo: 1800000,
    });
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F24 con meta, "Guardar meta" edita con el tipo y el valor juntos y nada más', async () => {
    await mostrar(META_MONTO);
    await escribirMonto('1800000');

    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith('m1', {
      tipoMeta: 'MONTO_FIJO',
      valorObjetivo: 1800000,
    });
    expect(Object.keys(actualizar.mock.calls[0][1]).sort()).toEqual(['tipoMeta', 'valorObjetivo']);
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF21-F24 al cambiar a "Porcentaje" y escribir 20 envía el tipo nuevo con su valor', async () => {
    await mostrar(META_MONTO);
    await elegirPorcentaje();
    await escribirPorcentaje('20');

    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith('m1', { tipoMeta: 'PORCENTAJE', valorObjetivo: 20 });
    expect(crear).not.toHaveBeenCalled();
  });

  it.each([
    ['monto', META_MONTO, { tipoMeta: 'MONTO_FIJO', valorObjetivo: 1500000 }],
    ['porcentaje', META_PORCENTAJE, { tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5 }],
  ])(
    'CA-RF21-F24 sin cambiar nada de una meta de %s se envía igual el mismo cuerpo y avisa que se guardó',
    async (_caso, meta, cuerpo) => {
      await mostrar(meta);

      await tocarGuardar();

      await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
      expect(actualizar).toHaveBeenCalledWith(meta.id, cuerpo);
      expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    },
  );

  it('CA-RF21-F25 al cambiar de tipo en una meta existente, sin escribir el valor nuevo no se envía', async () => {
    await mostrar(META_MONTO);
    await elegirPorcentaje();

    await tocarGuardar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.porcentajeVacio);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F26 mientras guarda, "Guardar meta" muestra un indicador, no se puede tocar y lo escrito sigue visible', async () => {
    const respuesta = pendiente<MetaAhorro>();
    crear.mockReturnValueOnce(respuesta.promesa);
    await mostrar(null);
    await escribirMonto('1500000');
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);

    expect(screen.queryByText('Guardar meta')).toBeNull();
    expect(botonGuardar).toBeDisabled();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    await act(async () => respuesta.resolver({ ...META_MONTO }));
  });

  it('CA-RF21-F27 dos toques seguidos al crear envían una sola solicitud con una sola clave', async () => {
    const respuesta = pendiente<MetaAhorro>();
    crear.mockReturnValueOnce(respuesta.promesa);
    await mostrar(null);
    await escribirMonto('1500000');
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(crear).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver({ ...META_MONTO }));
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F28 dos toques seguidos al editar envían una sola solicitud', async () => {
    const respuesta = pendiente<MetaAhorro>();
    actualizar.mockReturnValueOnce(respuesta.promesa);
    await mostrar(META_MONTO);
    await escribirMonto('1800000');
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(actualizar).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver({ ...META_MONTO, valorObjetivo: 1800000 }));
    expect(actualizar).toHaveBeenCalledTimes(1);
  });
});

describe('Meta de ahorro: errores al guardar', () => {
  it('CA-RF21-F29 si ya existe una meta del mes (409 al crear) avisa, carga la que está guardada y el siguiente guardado edita', async () => {
    obtener.mockResolvedValueOnce(null).mockResolvedValueOnce(META_MONTO);
    crear.mockRejectedValueOnce(new ApiError(409, 'Ya existe una meta de ahorro para ese mes'));
    await mostrar(null);
    await escribirMonto('900000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.yaExiste)).toBeOnTheScreen();
    await waitFor(() => expect(obtener).toHaveBeenCalledTimes(2));
    expect(obtener).toHaveBeenLastCalledWith('2026-09');
    expect(await screen.findByDisplayValue('$ 1.500.000')).toBeOnTheScreen();
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(screen.queryByText('Ya existe una meta de ahorro para ese mes')).toBeNull();

    await escribirMonto('1800000');
    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith('m1', {
      tipoMeta: 'MONTO_FIJO',
      valorObjetivo: 1800000,
    });
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F29 si la recarga tras el 409 también falla, muestra el aviso general de guardado', async () => {
    obtener.mockResolvedValueOnce(null).mockRejectedValueOnce(new ApiError(500, 'x'));
    crear.mockRejectedValueOnce(new ApiError(409, 'Ya existe una meta de ahorro para ese mes'));
    await mostrar(null);
    await escribirMonto('900000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.errorGuardar)).toBeOnTheScreen();
  });

  it('CA-RF21-F30 si la meta ya no existe (404 al editar) avisa, conserva lo escrito, quita "Quitar meta" y el siguiente guardado crea', async () => {
    actualizar.mockRejectedValueOnce(new ApiError(404, 'Meta de ahorro no encontrada'));
    await mostrar(META_MONTO);
    await escribirMonto('1800000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.800.000');
    expect(hayQuitar()).toBe(false);

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear).toHaveBeenCalledWith(
      { tipoMeta: 'MONTO_FIJO', valorObjetivo: 1800000, periodo: '2026-09' },
      expect.stringMatching(UUID),
    );
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F31 sin conexión al crear avisa, conserva lo escrito y reintenta con la misma clave y el mismo cuerpo', async () => {
    crear.mockRejectedValueOnce(new NetworkError());
    await mostrar(null);
    await escribirMonto('1500000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.red)).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
    expect(guardar()).toBeEnabled();

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
    expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
    expect(crear.mock.calls[1][0]).toEqual(crear.mock.calls[0][0]);
    await waitFor(() => expect(screen.queryByText(TEXTO.red)).toBeNull());
  });

  it('CA-RF21-F31 sin conexión al editar avisa, conserva lo escrito y reintenta el mismo cambio', async () => {
    actualizar.mockRejectedValueOnce(new NetworkError());
    await mostrar(META_MONTO);
    await escribirMonto('1800000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.red)).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.800.000');

    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(2));
    expect(actualizar.mock.calls[1]).toEqual(actualizar.mock.calls[0]);
    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO.red)).toBeNull();
  });

  it.each([400, 422, 500])(
    'CA-RF21-F32 ante un %s al crear muestra el mensaje general, sin textos del backend, y reintenta con la misma clave',
    async (status) => {
      crear.mockRejectedValueOnce(new ApiError(status, 'valorObjetivo debe ser mayor que 0'));
      await mostrar(null);
      await escribirMonto('1500000');

      await tocarGuardar();

      expect(await screen.findByText(TEXTO.errorGuardar)).toBeOnTheScreen();
      expect(screen.queryByText(/valorObjetivo/)).toBeNull();
      expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');

      await tocarGuardar();

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
    },
  );

  it.each([400, 422, 500])(
    'CA-RF21-F32 ante un %s al editar muestra el mensaje general con el formulario abierto y lo escrito intacto',
    async (status) => {
      actualizar.mockRejectedValueOnce(new ApiError(status, 'x'));
      await mostrar(META_MONTO);
      await escribirMonto('1800000');

      await tocarGuardar();

      expect(await screen.findByText(TEXTO.errorGuardar)).toBeOnTheScreen();
      expect(campoMonto()).toHaveDisplayValue('$ 1.800.000');
      expect(guardar()).toBeEnabled();
    },
  );

  it.each([
    ['falta de conexión', () => new NetworkError(), TEXTO.red],
    ['un error del servidor (500)', () => new ApiError(500, 'x'), TEXTO.errorGuardar],
  ])(
    'CA-RF21-F33 si el primer intento falló por %s y el usuario cambia el valor, es una acción nueva con otra clave',
    async (_caso, error, aviso) => {
      crear.mockRejectedValueOnce(error());
      await mostrar(null);
      await escribirMonto('1500000');
      await tocarGuardar();
      await screen.findByText(aviso);

      await escribirMonto('1800000');
      await tocarGuardar();

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][0]).toEqual({
        tipoMeta: 'MONTO_FIJO',
        valorObjetivo: 1800000,
        periodo: '2026-09',
      });
      expect(crear.mock.calls[1][1]).toMatch(UUID);
      expect(crear.mock.calls[1][1]).not.toBe(crear.mock.calls[0][1]);
    },
  );

  it.each([
    ['falta de conexión', () => new NetworkError(), TEXTO.red],
    ['un error del servidor (500)', () => new ApiError(500, 'x'), TEXTO.errorGuardar],
  ])(
    'CA-RF21-F33 si el primer intento falló por %s y el usuario cambia el tipo, es una acción nueva con otra clave',
    async (_caso, error, aviso) => {
      crear.mockRejectedValueOnce(error());
      await mostrar(null);
      await escribirMonto('1500000');
      await tocarGuardar();
      await screen.findByText(aviso);

      await elegirPorcentaje();
      await escribirPorcentaje('20');
      await tocarGuardar();

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][0]).toEqual({
        tipoMeta: 'PORCENTAJE',
        valorObjetivo: 20,
        periodo: '2026-09',
      });
      expect(crear.mock.calls[1][1]).toMatch(UUID);
      expect(crear.mock.calls[1][1]).not.toBe(crear.mock.calls[0][1]);
    },
  );

  it('CA-RF21-F34 ante un 401 al guardar el formulario no muestra un aviso de error propio', async () => {
    crear.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await mostrar(null);
    await escribirMonto('1500000');

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Guardar meta')).not.toBeNull());
    sinAlertas();
  });
});

describe('Meta de ahorro: quitar la meta', () => {
  it('CA-RF21-F35 "Quitar meta" pide confirmación con su texto y todavía no quita nada', async () => {
    await abrirDialogo();

    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dialogoDetalle)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Quitar')).toBeOnTheScreen();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F36 "Cancelar" cierra el diálogo sin quitar nada y la meta sigue en el formulario', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(eliminar).not.toHaveBeenCalled();
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
  });

  it('CA-RF21-F37 confirmar quita la meta una sola vez, cierra el diálogo y deja el formulario como sin meta', async () => {
    await abrirDialogo(META_PORCENTAJE);

    await fireEvent.press(boton('Quitar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(eliminar).toHaveBeenCalledWith('m2');
    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(await screen.findByText(TEXTO.quitada)).toBeOnTheScreen();
    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('');
    expect(hayQuitar()).toBe(false);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F37 después de quitar, el siguiente "Guardar meta" crea una meta nueva con su clave', async () => {
    await abrirDialogo();
    await fireEvent.press(boton('Quitar'));
    await screen.findByText(TEXTO.quitada);

    await escribirMonto('900000');
    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear).toHaveBeenCalledWith(
      { tipoMeta: 'MONTO_FIJO', valorObjetivo: 900000, periodo: '2026-09' },
      expect.stringMatching(UUID),
    );
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF21-F38 mientras quita, "Quitar" muestra un indicador, los dos botones no se pueden tocar y un doble toque no repite', async () => {
    const respuesta = pendiente<void>();
    eliminar.mockReturnValueOnce(respuesta.promesa);
    await abrirDialogo();
    const quitar = boton('Quitar');
    const cancelar = boton('Cancelar');

    await fireEvent.press(quitar);
    await fireEvent.press(quitar);

    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Quitar')).toBeNull();
    expect(quitar).toBeDisabled();
    expect(cancelar).toBeDisabled();
    await act(async () => respuesta.resolver());
    expect(eliminar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF21-F39 si la meta tiene ahorro registrado (409) lo explica dentro del diálogo y la meta sigue', async () => {
    eliminar.mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar una meta que ya tiene ahorro registrado'),
    );
    await abrirDialogo();

    await fireEvent.press(boton('Quitar'));

    expect(await screen.findByText(TEXTO.conAhorro)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(
      screen.queryByText('No se puede eliminar una meta que ya tiene ahorro registrado'),
    ).toBeNull();

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
  });

  it('CA-RF21-F40 si la meta ya estaba quitada (404) cierra el diálogo y deja el formulario sin meta, sin aviso de error', async () => {
    eliminar.mockRejectedValueOnce(new ApiError(404, 'Meta de ahorro no encontrada'));
    await abrirDialogo();

    await fireEvent.press(boton('Quitar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(hayQuitar()).toBe(false);
    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('');
    sinAvisosDeError();
  });

  it('CA-RF21-F41 sin conexión al quitar avisa dentro del diálogo, "Quitar" vuelve a estar disponible y la meta sigue', async () => {
    eliminar.mockRejectedValueOnce(new NetworkError());
    await abrirDialogo();

    await fireEvent.press(boton('Quitar'));

    expect(await screen.findByText(TEXTO.red)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Quitar')).toBeEnabled();

    await fireEvent.press(boton('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(campoMonto()).toHaveDisplayValue('$ 1.500.000');
  });

  it.each([400, 500])(
    'CA-RF21-F41 ante un %s al quitar avisa dentro del diálogo y deja reintentar',
    async (status) => {
      eliminar.mockRejectedValueOnce(new ApiError(status, 'x'));
      await abrirDialogo();

      await fireEvent.press(boton('Quitar'));

      expect(await screen.findByText(TEXTO.errorQuitar)).toBeOnTheScreen();
      expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
      expect(boton('Quitar')).toBeEnabled();

      await fireEvent.press(boton('Quitar'));

      await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(dialogoAbierto()).toBe(false));
    },
  );

  it('CA-RF21-F42 ante un 401 al quitar el diálogo no muestra un aviso de error propio', async () => {
    eliminar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
    await abrirDialogo();

    await fireEvent.press(boton('Quitar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Quitar')).not.toBeNull());
    sinAlertas();
  });
});

describe('Meta de ahorro: accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)', () => {
  it('CA-RF21-F43 los botones, los campos, los avisos y el diálogo se anuncian con su nombre', async () => {
    await mostrar(META_MONTO);

    expect(boton('Volver')).toBeOnTheScreen();
    expect(boton('Monto', { selected: true })).toBeOnTheScreen();
    expect(boton('Porcentaje', { selected: false })).toBeOnTheScreen();
    expect(boton('Guardar meta')).toBeOnTheScreen();
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos')).toBeOnTheScreen();

    await elegirPorcentaje();
    expect(boton('Porcentaje', { selected: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Porcentaje de tus ingresos')).toBeOnTheScreen();

    await tocarGuardar();
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.porcentajeVacio);

    await fireEvent.press(boton('Quitar meta'));
    expect(await screen.findByLabelText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Quitar')).toBeOnTheScreen();
  });

  it('CA-RF21-F43 el aviso de error al guardar se anuncia como alerta', async () => {
    crear.mockRejectedValueOnce(new ApiError(500, 'x'));
    await mostrar(null);
    await escribirMonto('1500000');
    await tocarGuardar();
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorGuardar);
  });

  it('CA-RF21-F43 el aviso de error al quitar se anuncia como alerta', async () => {
    eliminar.mockRejectedValueOnce(new ApiError(500, 'x'));
    await abrirDialogo();

    await fireEvent.press(boton('Quitar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorQuitar);
  });

  it('CA-RF21-F43 el aviso de error al cargar se anuncia como alerta', async () => {
    obtener.mockRejectedValueOnce(new ApiError(500, 'x'));
    await render(<MetaDeAhorro />);

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
  });

  const TECNICO =
    /MONTO_FIJO|PORCENTAJE|periodo|valorObjetivo|idempotenc|payload|ApiError|NetworkError|internal server|\b(400|404|409|422|500)\b/i;
  // Sin la bandera "i" para las palabras en mayúsculas: "Porcentaje" y "Monto" son textos válidos
  const TECNICO_EN_MAYUSCULAS = /MONTO_FIJO|PORCENTAJE\b/;

  it.each([
    ['sin meta', null],
    ['con una meta de monto', META_MONTO],
    ['con una meta de porcentaje', META_PORCENTAJE],
  ])(
    'CA-RF21-F44 los textos de la pantalla %s no usan términos técnicos ni contables',
    async (_caso, meta) => {
      await mostrar(meta);
      await fireEvent.press(guardar());

      const texto = textosEnOrden().join(' | ');
      expect(texto).not.toMatch(TECNICO_EN_MAYUSCULAS);
      expect(texto.replace(/Porcentaje|porcentaje/g, '')).not.toMatch(TECNICO);
    },
  );

  it.each([
    ['la validación del monto', null, 'monto', TEXTO.montoVacio],
    ['la validación del porcentaje', null, 'porcentaje', TEXTO.porcentajeVacio],
    ['sin conexión', new NetworkError(), 'monto', TEXTO.red],
    [
      'un error del servidor',
      new ApiError(500, 'Internal server error'),
      'monto',
      TEXTO.errorGuardar,
    ],
    [
      'una meta que ya existe',
      new ApiError(409, 'Ya existe una meta de ahorro para ese mes'),
      'monto',
      TEXTO.yaExiste,
    ],
  ])(
    'CA-RF21-F44 el aviso de %s habla con palabras cotidianas',
    async (_caso, error, tipo, aviso) => {
      if (error) crear.mockRejectedValueOnce(error);
      await mostrar(null);
      if (tipo === 'porcentaje') await elegirPorcentaje();
      else if (error) await escribirMonto('1500000');

      await tocarGuardar();
      await screen.findByText(aviso);

      const texto = textosEnOrden().join(' | ');
      expect(texto).not.toMatch(TECNICO_EN_MAYUSCULAS);
      expect(texto.replace(/Porcentaje|porcentaje/g, '')).not.toMatch(TECNICO);
    },
  );

  it('CA-RF21-F44 el diálogo y sus avisos no usan términos técnicos ni contables', async () => {
    eliminar.mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar una meta que ya tiene ahorro registrado'),
    );
    await abrirDialogo();
    await fireEvent.press(boton('Quitar'));
    await screen.findByText(TEXTO.conAhorro);

    const texto = textosEnOrden().join(' | ');
    expect(texto).not.toMatch(TECNICO_EN_MAYUSCULAS);
    expect(texto.replace(/Porcentaje|porcentaje/g, '')).not.toMatch(TECNICO);
  });

  it('CA-RF21-F45 un porcentaje no se convierte en pesos: ni se muestra un monto ni se envía otro valor que el escrito', async () => {
    await mostrar(null);
    await elegirPorcentaje();
    await escribirPorcentaje('20');

    expect(textosEnOrden().join(' ')).not.toContain('$');
    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({
      tipoMeta: 'PORCENTAJE',
      valorObjetivo: 20,
      periodo: '2026-09',
    });
    await screen.findByText(TEXTO.guardada);
    expect(textosEnOrden().join(' ')).not.toContain('$');
  });

  it('CA-RF21-F45 al editar un porcentaje va tal cual y una meta de porcentaje cargada no muestra pesos', async () => {
    await mostrar(META_PORCENTAJE);
    expect(textosEnOrden().join(' ')).not.toContain('$');
    await escribirPorcentaje('20');

    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith('m2', { tipoMeta: 'PORCENTAJE', valorObjetivo: 20 });
  });

  it('CA-RF21-F45 un monto nunca se envía como porcentaje', async () => {
    await mostrar(null);
    await escribirMonto('1500000');

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toMatchObject({
      tipoMeta: 'MONTO_FIJO',
      valorObjetivo: 1500000,
    });
  });
});
