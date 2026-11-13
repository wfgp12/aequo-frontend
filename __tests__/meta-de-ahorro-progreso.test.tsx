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

// Tarjeta de progreso de la pantalla "Meta de ahorro" (criterios/04-ahorro-progreso.md, CA-RF22-F01 a F32).
// El backend se simula en el borde del adaptador (lib/api/ahorro). Hoy es el 17 de septiembre de 2026 (reloj
// simulado): el mes actual es 2026-09. Las cifras las "responde" el backend simulado: la tarjeta no calcula nada.
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

const META_DEL_PROGRESO = {
  id: 'm1',
  tipoMeta: 'MONTO_FIJO' as const,
  valorObjetivo: 1500000,
  montoMeta: 1500000,
};

/** Una respuesta de GET /ahorro/progreso; lo que no se indica queda con valores de ejemplo. */
function respuesta(sobre: Partial<ProgresoAhorro> = {}): ProgresoAhorro {
  return {
    periodo: '2026-09',
    ingresoPropio: 4500000,
    egresos: 3250000,
    ahorroDelMes: 1250000,
    meta: META_DEL_PROGRESO,
    disponible: -250000,
    porcentajeAvance: 83.3333,
    ...sobre,
  };
}

const FALTAN_250 = respuesta(); // el caso del Figma: "83%" y "Te faltan $ 250.000 para tu meta"
const SIN_META = respuesta({
  ahorroDelMes: 300000,
  meta: null,
  disponible: 300000,
  porcentajeAvance: null,
});
const MITAD = respuesta({
  ahorroDelMes: 300000,
  disponible: -300000,
  porcentajeAvance: 50,
  meta: { ...META_DEL_PROGRESO, valorObjetivo: 600000, montoMeta: 600000 },
});
const EXCEDIDA = respuesta({
  ahorroDelMes: 300000,
  disponible: 100000,
  porcentajeAvance: 150,
  meta: { ...META_DEL_PROGRESO, valorObjetivo: 200000, montoMeta: 200000 },
});
const CUMPLIDA = respuesta({
  ahorroDelMes: 300000,
  disponible: 0,
  porcentajeAvance: 100,
  meta: { ...META_DEL_PROGRESO, valorObjetivo: 300000, montoMeta: 300000 },
});
const META_PORCENTAJE_DEL_PROGRESO = {
  id: 'm2',
  tipoMeta: 'PORCENTAJE' as const,
  valorObjetivo: 20,
  montoMeta: 0,
};

const TEXTO = {
  cargandoProgreso: 'Cargando tu progreso de ahorro',
  cargandoMeta: 'Cargando tu meta de ahorro',
  errorProgreso: 'No pudimos cargar tu progreso de ahorro. Inténtalo de nuevo en unos minutos.',
  errorMeta: 'No pudimos cargar tu meta de ahorro. Inténtalo de nuevo en unos minutos.',
  red: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  mes: 'Septiembre 2026',
  rotuloAhorro: 'Ahorro de este mes',
  cumplida: '¡Cumpliste tu meta de este mes!',
  invitacion: 'Todavía no fijaste tu meta de este mes. Hazlo más abajo y verás tu avance aquí.',
  sinIngresos:
    'Todavía no hay ingresos este mes para medir tu meta. Cuando registres uno, verás tu avance.',
  barra: 'Avance de tu meta de ahorro',
  reintentarProgreso: 'Reintentar progreso de ahorro',
  guardada: 'Meta guardada.',
  quitada: 'Meta quitada.',
  montoVacio: 'Escribe un monto mayor que cero.',
  porcentajeVacio: 'Escribe un porcentaje mayor que 0.',
  porcentajeAlto: 'El porcentaje no puede pasar de 100.',
  errorGuardar: 'No pudimos guardar tu meta. Revisa el valor e inténtalo de nuevo.',
  conAhorro: 'Esta meta ya tiene ahorro registrado y no se puede quitar.',
  errorQuitar: 'No pudimos quitar tu meta. Inténtalo de nuevo en unos minutos.',
  dialogo: '¿Quitar tu meta de ahorro?',
};
// Textos del formulario y del encabezado (lo que NO es de la tarjeta)
const TEXTOS_DEL_FORMULARIO = [
  '‹',
  'Meta de ahorro',
  'Monto',
  'Porcentaje',
  'Meta mensual',
  '% de tus ingresos',
  'Guardar meta',
  'Quitar meta',
  'Esta meta es para septiembre de 2026. Cada mes puedes fijar la tuya.',
  'Es lo que quieres que te quede cada mes después de restar tus egresos a tus ingresos.',
  'Es la parte de tus ingresos que quieres que te quede cada mes, después de restar tus egresos.',
];

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
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
const textoDeLaPantalla = () => textosEnOrden().join(' | ');
/** Lo que se lee en la tarjeta: todo el texto menos el encabezado y el formulario. */
const textoDeLaTarjeta = () =>
  textosEnOrden()
    .filter((t) => !TEXTOS_DEL_FORMULARIO.includes(t))
    .join(' | ');

const boton = (nombre: string, opciones = {}) =>
  screen.getByRole('button', { name: nombre, ...opciones });
const hayBoton = (nombre: string) => screen.queryByRole('button', { name: nombre }) !== null;
const barra = () => screen.getByRole('progressbar', { name: TEXTO.barra });
const hayBarra = () => screen.queryByRole('progressbar') !== null;
const campoMonto = () => screen.getByLabelText('Monto en pesos');
const campoPorcentaje = () => screen.getByLabelText('Porcentaje de tus ingresos');
const hayTexto = (texto: string | RegExp) => screen.queryByText(texto) !== null;
const dialogoAbierto = () => screen.queryByText(TEXTO.dialogo) !== null;

/** Abre la pantalla y espera a que la meta y el progreso terminen de cargar (con éxito o con aviso). */
async function mostrar(meta: MetaAhorro | null = null, datos: ProgresoAhorro = SIN_META) {
  obtener.mockResolvedValue(meta);
  progreso.mockReset().mockResolvedValue(datos);
  await render(<MetaDeAhorro />);
  await esperarCarga();
}
async function esperarCarga() {
  await screen.findByRole('button', { name: 'Guardar meta' });
  await waitFor(() => expect(screen.queryByLabelText(TEXTO.cargandoProgreso)).toBeNull());
}
async function escribirMonto(texto: string) {
  await fireEvent.changeText(campoMonto(), texto);
}
async function escribirPorcentaje(texto: string) {
  await fireEvent.changeText(campoPorcentaje(), texto);
}
async function tocarGuardar() {
  await fireEvent.press(boton('Guardar meta'));
}
async function abrirDialogo() {
  await mostrar(META_MONTO, FALTAN_250);
  await fireEvent.press(boton('Quitar meta'));
  await screen.findByText(TEXTO.dialogo);
}
/** Deja que termine todo lo que está en vuelo (una llamada de más se vería aquí). */
async function esperarQueAsiente() {
  await act(async () => {});
  await act(async () => {});
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
  progreso.mockReset().mockResolvedValue(SIN_META);
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

describe('Progreso del ahorro: consulta', () => {
  it('CA-RF22-F01 al entrar pide el progreso y la meta del mes actual, una vez cada uno y a la vez', async () => {
    const delProgreso = pendiente<ProgresoAhorro>();
    const delaMeta = pendiente<MetaAhorro | null>();
    progreso.mockReturnValueOnce(delProgreso.promesa);
    obtener.mockReturnValueOnce(delaMeta.promesa);

    await render(<MetaDeAhorro />);

    // Las dos salieron sin que ninguna haya respondido: ninguna espera a la otra
    expect(progreso).toHaveBeenCalledTimes(1);
    expect(progreso).toHaveBeenCalledWith('2026-09');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener).toHaveBeenCalledWith('2026-09');

    await act(async () => {
      delProgreso.resolver(FALTAN_250);
      delaMeta.resolver(null);
    });
    await esperarCarga();

    expect(progreso).toHaveBeenCalledTimes(1);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF22-F02 de arriba abajo se ve el título, la tarjeta con el mes y el formulario', async () => {
    await mostrar(null, FALTAN_250);

    const textos = textosEnOrden();
    const titulo = textos.indexOf('Meta de ahorro');
    const mes = textos.indexOf(TEXTO.mes);
    const formulario = textos.indexOf('Meta mensual');
    const guardar = textos.indexOf('Guardar meta');
    expect(titulo).toBeGreaterThanOrEqual(0);
    expect(mes).toBeGreaterThan(titulo);
    expect(formulario).toBeGreaterThan(mes);
    expect(guardar).toBeGreaterThan(formulario);
  });
});

describe('Progreso del ahorro: con meta', () => {
  it('CA-RF22-F03 muestra el mes, el ahorro del mes, el porcentaje, la barra y lo que falta', async () => {
    await mostrar(META_MONTO, FALTAN_250);

    expect(screen.getByText(TEXTO.mes)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.rotuloAhorro)).toBeOnTheScreen();
    expect(screen.getByText('$ 1.250.000')).toBeOnTheScreen();
    expect(screen.getByText('83%')).toBeOnTheScreen();
    expect(barra()).toBeOnTheScreen();
    expect(screen.getByText('Te faltan $ 250.000 para tu meta')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.cumplida)).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
  });

  it.each([
    ['el porcentaje 83,5 se muestra "84%"', { porcentajeAvance: 83.5 }, '84%'],
    [
      'el porcentaje 723,6138 se muestra "724%"',
      { porcentajeAvance: 723.6138, disponible: 5 },
      '724%',
    ],
    [
      'el ahorro del mes 1134897,87 se muestra "$ 1.134.898"',
      { ahorroDelMes: 1134897.87 },
      '$ 1.134.898',
    ],
    [
      'lo que falta (-249999,6) se muestra al peso',
      { disponible: -249999.6 },
      'Te faltan $ 250.000 para tu meta',
    ],
  ])(
    'CA-RF22-F04 se redondea solo al mostrar: %s, sin decimales',
    async (_caso, sobre, esperado) => {
      await mostrar(META_MONTO, respuesta(sobre));

      expect(screen.getByText(esperado)).toBeOnTheScreen();
      expect(textoDeLaPantalla()).not.toMatch(/\d,\d/);
    },
  );

  it('CA-RF22-F05 con la meta cumplida exacta ve 100%, la barra llena y el mensaje, sin "Te faltan"', async () => {
    await mostrar(META_MONTO, CUMPLIDA);

    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 100 });
    expect(screen.getByText(TEXTO.rotuloAhorro)).toBeOnTheScreen();
    expect(screen.getByText('$ 300.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.cumplida)).toBeOnTheScreen();
    expect(hayTexto(/Te faltan/)).toBe(false);
    expect(hayTexto(/Ahorraste/)).toBe(false);
  });

  it('CA-RF22-F06 con la meta excedida dice el porcentaje real, la barra llena y lo que sobró', async () => {
    await mostrar(META_MONTO, EXCEDIDA);

    expect(screen.getByText('150%')).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 100 });
    expect(screen.getByText(TEXTO.cumplida)).toBeOnTheScreen();
    expect(screen.getByText('Ahorraste $ 100.000 más de lo que querías.')).toBeOnTheScreen();
    expect(hayTexto(/Te faltan/)).toBe(false);
  });

  it('CA-RF22-F06 el porcentaje real no tiene tope: 166,6667 se ve "167%"', async () => {
    await mostrar(META_MONTO, respuesta({ porcentajeAvance: 166.6667, disponible: 100000 }));

    expect(screen.getByText('167%')).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 100 });
  });

  it('CA-RF22-F07 con ahorro negativo ve el signo, "-125%", la barra vacía y lo que falta en positivo', async () => {
    await mostrar(
      META_MONTO,
      respuesta({
        ahorroDelMes: -250000,
        disponible: -450000,
        porcentajeAvance: -125,
        meta: { ...META_PORCENTAJE_DEL_PROGRESO, montoMeta: 200000 },
      }),
    );

    expect(screen.getByText('-$ 250.000')).toBeOnTheScreen();
    expect(screen.getByText('-125%')).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 0 });
    expect(screen.getByText('Te faltan $ 450.000 para tu meta')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.cumplida)).toBe(false);
  });

  it('CA-RF22-F08 con meta de monto fijo y sin ahorro ve "$ 0", "0%", la barra vacía y lo que falta', async () => {
    await mostrar(
      META_MONTO,
      respuesta({
        ingresoPropio: 0,
        egresos: 0,
        ahorroDelMes: 0,
        disponible: -300000,
        porcentajeAvance: 0,
        meta: { ...META_DEL_PROGRESO, valorObjetivo: 300000, montoMeta: 300000 },
      }),
    );

    expect(screen.getByText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText('0%')).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 0 });
    expect(screen.getByText('Te faltan $ 300.000 para tu meta')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
  });

  it.each([
    [
      'un faltante menor a medio peso se trata como meta cumplida',
      { ahorroDelMes: 299999.7, disponible: -0.3, porcentajeAvance: 99.99 },
      TEXTO.cumplida,
    ],
    [
      'un sobrante menor a medio peso no agrega lo que sobró',
      { ahorroDelMes: 300000.3, disponible: 0.3, porcentajeAvance: 100 },
      TEXTO.cumplida,
    ],
    [
      'un ahorro y un porcentaje que quedan en cero se escriben sin signo',
      { ahorroDelMes: -0.3, disponible: -300000.3, porcentajeAvance: -0.3 },
      'Te faltan $ 300.000 para tu meta',
    ],
  ])('CA-RF22-F09 los redondeos no dejan textos raros: %s', async (_caso, sobre, esperado) => {
    await mostrar(
      META_MONTO,
      respuesta({
        ...sobre,
        meta: { ...META_DEL_PROGRESO, valorObjetivo: 300000, montoMeta: 300000 },
      }),
    );

    expect(screen.getByText(esperado)).toBeOnTheScreen();
    const texto = textoDeLaPantalla();
    expect(texto).not.toMatch(/Te faltan \$ 0(?![\d.])/);
    expect(texto).not.toMatch(/-0%/);
    expect(texto).not.toMatch(/-\$ 0(?![\d.])/);
    expect(texto).not.toMatch(/Ahorraste \$ 0(?![\d.])/);
  });

  it('CA-RF22-F09 un ahorro y un porcentaje en cero por redondeo se leen "$ 0" y "0%"', async () => {
    await mostrar(
      META_MONTO,
      respuesta({ ahorroDelMes: -0.3, disponible: -300000.3, porcentajeAvance: -0.3 }),
    );

    expect(screen.getByText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText('0%')).toBeOnTheScreen();
  });

  it.each([
    [83.3333, 83, -250000],
    [150, 100, 100000],
    [166.6667, 100, 100000],
    [-125, 0, -450000],
    [0, 0, -300000],
    [100, 100, 0],
  ])(
    'CA-RF22-F10 la barra "Avance de tu meta de ahorro" con %s por ciento vale %s de 0 a 100',
    async (porcentaje, valor, disponible) => {
      await mostrar(META_MONTO, respuesta({ porcentajeAvance: porcentaje, disponible }));

      expect(barra()).toHaveAccessibilityValue({ now: valor });
      // El texto sigue mostrando el valor real, sin límite
      expect(screen.getByText(`${Math.round(porcentaje) || 0}%`)).toBeOnTheScreen();
    },
  );

  it('CA-RF22-F11 muestra lo que responde el backend aunque las cifras no cuadren, sin ingresos, egresos ni monto de la meta', async () => {
    await mostrar(
      META_MONTO,
      respuesta({
        ingresoPropio: 987654,
        egresos: 123456,
        ahorroDelMes: 300000,
        porcentajeAvance: 37,
        disponible: -111000,
        meta: { ...META_DEL_PROGRESO, valorObjetivo: 600000, montoMeta: 600000 },
      }),
    );

    expect(screen.getByText('37%')).toBeOnTheScreen();
    expect(screen.getByText('Te faltan $ 111.000 para tu meta')).toBeOnTheScreen();
    expect(hayTexto('50%')).toBe(false);
    expect(hayTexto('Te faltan $ 300.000 para tu meta')).toBe(false);
    const texto = textoDeLaPantalla();
    expect(texto).not.toContain('600.000');
    expect(texto).not.toContain('987.654');
    expect(texto).not.toContain('123.456');
  });
});

describe('Progreso del ahorro: sin meta y meta sin porcentaje', () => {
  const SIN_PORCENTAJE = [
    ['sin ingresos y sin ahorro', { ahorroDelMes: 0, disponible: 0 }, '$ 0'],
    ['con un ahorro negativo', { ahorroDelMes: -100000, disponible: -100000 }, '-$ 100.000'],
  ] as const;

  it('CA-RF22-F12 sin meta ve el mes, el ahorro del mes y la invitación a fijarla, sin porcentaje ni barra', async () => {
    await mostrar(null, SIN_META);

    expect(screen.getByText(TEXTO.mes)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.rotuloAhorro)).toBeOnTheScreen();
    expect(screen.getByText('$ 300.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(hayBarra()).toBe(false);
    expect(textoDeLaPantalla()).not.toMatch(/\d%/);
    expect(hayTexto(/Te faltan/)).toBe(false);
    expect(hayTexto(TEXTO.cumplida)).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    // La invitación es solo un texto: no hay un botón propio en la tarjeta
    expect(hayBoton(TEXTO.reintentarProgreso)).toBe(false);
    expect(screen.queryByRole('button', { name: /fijar|hazlo|crear/i })).toBeNull();
  });

  it('CA-RF22-F12 sin meta y con ahorro negativo ve el ahorro con signo', async () => {
    await mostrar(null, respuesta({ ...SIN_META, ahorroDelMes: -100000, disponible: -100000 }));

    expect(screen.getByText('-$ 100.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.invitacion)).toBeOnTheScreen();
  });

  it.each(SIN_PORCENTAJE)(
    'CA-RF22-F13 con meta pero sin ingresos del mes (%s) no hay porcentaje, barra ni "Te faltan"',
    async (_caso, sobre, ahorro) => {
      await mostrar(
        META_MONTO,
        respuesta({
          ...sobre,
          ingresoPropio: 0,
          porcentajeAvance: null,
          meta: META_PORCENTAJE_DEL_PROGRESO,
        }),
      );

      expect(screen.getByText(TEXTO.mes)).toBeOnTheScreen();
      expect(screen.getByText(TEXTO.rotuloAhorro)).toBeOnTheScreen();
      expect(screen.getByText(ahorro)).toBeOnTheScreen();
      expect(screen.getByText(TEXTO.sinIngresos)).toBeOnTheScreen();
      expect(hayBarra()).toBe(false);
      expect(textoDeLaPantalla()).not.toMatch(/\d%/);
      expect(hayTexto(/Te faltan/)).toBe(false);
      expect(hayTexto(TEXTO.cumplida)).toBe(false);
      expect(textoDeLaPantalla()).not.toMatch(/NaN|Infinity|null/);
    },
  );

  const EN_CERO = { ingresoPropio: 0, egresos: 0, ahorroDelMes: 0, disponible: 0 };

  it('CA-RF22-F14 un mes sin movimientos y sin meta ve "$ 0" y la invitación, sin error', async () => {
    await mostrar(null, respuesta({ ...EN_CERO, meta: null, porcentajeAvance: null }));

    expect(screen.getByText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
  });

  it('CA-RF22-F14 un mes sin movimientos con meta de monto fijo ve lo mismo que CA-RF22-F08', async () => {
    await mostrar(
      META_MONTO,
      respuesta({
        ...EN_CERO,
        disponible: -300000,
        porcentajeAvance: 0,
        meta: { ...META_DEL_PROGRESO, valorObjetivo: 300000, montoMeta: 300000 },
      }),
    );

    expect(screen.getByText('$ 0')).toBeOnTheScreen();
    expect(screen.getByText('0%')).toBeOnTheScreen();
    expect(screen.getByText('Te faltan $ 300.000 para tu meta')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF22-F14 un mes sin movimientos con meta de porcentaje ve lo mismo que CA-RF22-F13', async () => {
    await mostrar(
      META_MONTO,
      respuesta({
        ...EN_CERO,
        porcentajeAvance: null,
        meta: META_PORCENTAJE_DEL_PROGRESO,
      }),
    );

    expect(screen.getByText(TEXTO.sinIngresos)).toBeOnTheScreen();
    expect(hayBarra()).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Progreso del ahorro: cargando y errores', () => {
  it('CA-RF22-F15 mientras carga solo se ve el indicador, sin cifras, barra, invitación ni avisos', async () => {
    const delProgreso = pendiente<ProgresoAhorro>();
    progreso.mockReturnValueOnce(delProgreso.promesa);

    await render(<MetaDeAhorro />);
    await screen.findByRole('button', { name: 'Guardar meta' });

    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();
    expect(hayTexto(TEXTO.mes)).toBe(false);
    expect(hayTexto(TEXTO.rotuloAhorro)).toBe(false);
    expect(textoDeLaPantalla()).not.toMatch(/\d%|\$ \d/);
    expect(hayBarra()).toBe(false);
    expect(hayTexto(TEXTO.invitacion)).toBe(false);
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => delProgreso.resolver(FALTAN_250));

    expect(await screen.findByText('83%')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoProgreso)).toBeNull();
  });

  it('CA-RF22-F16 si el progreso llega primero ve la tarjeta con datos y el formulario todavía cargando', async () => {
    const delProgreso = pendiente<ProgresoAhorro>();
    const delaMeta = pendiente<MetaAhorro | null>();
    progreso.mockReturnValueOnce(delProgreso.promesa);
    obtener.mockReturnValueOnce(delaMeta.promesa);
    await render(<MetaDeAhorro />);

    await act(async () => delProgreso.resolver(FALTAN_250));

    expect(await screen.findByText('83%')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoProgreso)).toBeNull();
    expect(screen.getByLabelText(TEXTO.cargandoMeta)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Guardar meta' })).toBeNull();

    await act(async () => delaMeta.resolver(null));

    expect(await screen.findByRole('button', { name: 'Guardar meta' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoMeta)).toBeNull();
  });

  it('CA-RF22-F16 si la meta llega primero ve el formulario y la tarjeta todavía cargando', async () => {
    const delProgreso = pendiente<ProgresoAhorro>();
    progreso.mockReturnValueOnce(delProgreso.promesa);
    await render(<MetaDeAhorro />);

    expect(await screen.findByRole('button', { name: 'Guardar meta' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoMeta)).toBeNull();
    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();

    await act(async () => delProgreso.resolver(FALTAN_250));

    expect(await screen.findByText('83%')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoProgreso)).toBeNull();
  });

  it.each([
    ['un 500', new ApiError(500, 'Internal server error')],
    ['un 400', new ApiError(400, 'mes debe tener el formato YYYY-MM')],
  ])(
    'CA-RF22-F17 ante %s avisa en la tarjeta con "Reintentar" y sin cifras',
    async (_caso, error) => {
      obtener.mockResolvedValue(null);
      progreso.mockReset().mockRejectedValue(error);

      await render(<MetaDeAhorro />);

      expect(await screen.findByText(TEXTO.errorProgreso)).toBeOnTheScreen();
      expect(screen.getByText('Reintentar')).toBeOnTheScreen();
      expect(boton(TEXTO.reintentarProgreso)).toBeOnTheScreen();
      expect(textoDeLaPantalla()).not.toMatch(/\d%|\$ \d/);
      expect(hayBarra()).toBe(false);
      expect(hayTexto(TEXTO.mes)).toBe(false);
      expect(hayTexto(error.message)).toBe(false);
    },
  );

  it('CA-RF22-F18 sin conexión avisa con "Reintentar" y el título y "Volver" siguen visibles', async () => {
    progreso.mockReset().mockRejectedValue(new NetworkError());

    await render(<MetaDeAhorro />);

    expect(await screen.findByText(TEXTO.red)).toBeOnTheScreen();
    expect(boton(TEXTO.reintentarProgreso)).toBeOnTheScreen();
    expect(screen.getByText('Meta de ahorro')).toBeOnTheScreen();
    expect(boton('Volver')).toBeOnTheScreen();
  });

  it('CA-RF22-F19 "Reintentar" vuelve a pedir el mismo mes, muestra la carga y no vuelve a pedir la meta', async () => {
    const segunda = pendiente<ProgresoAhorro>();
    progreso
      .mockReset()
      .mockRejectedValueOnce(new ApiError(500, 'x'))
      .mockReturnValueOnce(segunda.promesa);
    await render(<MetaDeAhorro />);
    await screen.findByText(TEXTO.errorProgreso);

    await fireEvent.press(boton(TEXTO.reintentarProgreso));

    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(progreso).toHaveBeenLastCalledWith('2026-09');
    expect(obtener).toHaveBeenCalledTimes(1);

    await act(async () => segunda.resolver(FALTAN_250));

    expect(await screen.findByText('83%')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
  });

  it('CA-RF22-F19 si el reintento falla otra vez ve de nuevo el aviso', async () => {
    progreso.mockReset().mockRejectedValue(new ApiError(500, 'x'));
    await render(<MetaDeAhorro />);
    await screen.findByText(TEXTO.errorProgreso);

    await fireEvent.press(boton(TEXTO.reintentarProgreso));

    expect(await screen.findByText(TEXTO.errorProgreso)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
  });

  it('CA-RF22-F20 ante un 401 la tarjeta no muestra un aviso de error propio', async () => {
    progreso.mockReset().mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await render(<MetaDeAhorro />);
    await waitFor(() => expect(progreso).toHaveBeenCalledTimes(1));
    await esperarQueAsiente();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(hayTexto(TEXTO.errorProgreso)).toBe(false);
    expect(hayBoton(TEXTO.reintentarProgreso)).toBe(false);
    expect(hayTexto('Reintentar')).toBe(false);
  });

  it('CA-RF22-F21 un error del progreso no bloquea el formulario: se guarda y se ve "Meta guardada."', async () => {
    progreso.mockReset().mockRejectedValueOnce(new ApiError(500, 'x')).mockResolvedValue(SIN_META);
    await render(<MetaDeAhorro />);
    await screen.findByText(TEXTO.errorProgreso);
    expect(screen.getByRole('button', { name: 'Monto', selected: true })).toBeOnTheScreen();
    expect(campoMonto()).toBeOnTheScreen();
    expect(hayBoton('Quitar meta')).toBe(false);
    await escribirMonto('1500000');

    await tocarGuardar();

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
  });

  it('CA-RF22-F21 con una meta guardada, el formulario completo funciona aunque falle el progreso', async () => {
    obtener.mockResolvedValue(META_MONTO);
    progreso
      .mockReset()
      .mockRejectedValueOnce(new ApiError(500, 'x'))
      .mockResolvedValue(FALTAN_250);
    await render(<MetaDeAhorro />);
    await screen.findByText(TEXTO.errorProgreso);
    expect(boton('Quitar meta')).toBeOnTheScreen();
    await escribirMonto('1800000');

    await tocarGuardar();

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
  });

  it('CA-RF22-F22 si falla la meta del mes, la tarjeta se ve con sus datos y debajo el aviso con su "Reintentar"', async () => {
    obtener.mockReset().mockRejectedValue(new ApiError(500, 'x'));
    progreso.mockReset().mockResolvedValue(FALTAN_250);

    await render(<MetaDeAhorro />);

    expect(await screen.findByText(TEXTO.errorMeta)).toBeOnTheScreen();
    expect(screen.getByText('83%')).toBeOnTheScreen();
    expect(screen.getByText('Te faltan $ 250.000 para tu meta')).toBeOnTheScreen();
    expect(boton('Reintentar')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Guardar meta' })).toBeNull();
    const textos = textosEnOrden();
    expect(textos.indexOf(TEXTO.errorMeta)).toBeGreaterThan(textos.indexOf('83%'));
  });

  it('CA-RF22-F22 cada "Reintentar" vuelve a cargar solo lo suyo', async () => {
    obtener.mockReset().mockRejectedValue(new ApiError(500, 'x'));
    progreso.mockReset().mockRejectedValue(new ApiError(500, 'x'));
    await render(<MetaDeAhorro />);
    await screen.findByText(TEXTO.errorMeta);
    await screen.findByText(TEXTO.errorProgreso);

    await fireEvent.press(boton(TEXTO.reintentarProgreso));
    await esperarQueAsiente();

    expect(progreso).toHaveBeenCalledTimes(2);
    expect(obtener).toHaveBeenCalledTimes(1);

    await fireEvent.press(boton('Reintentar'));
    await esperarQueAsiente();

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(progreso).toHaveBeenCalledTimes(2);
  });
});

describe('Progreso del ahorro: se actualiza al guardar, cambiar o quitar la meta', () => {
  it('CA-RF22-F23 al crear la meta, la tarjeta pasa de la invitación al avance', async () => {
    await mostrar(null, SIN_META);
    progreso.mockResolvedValueOnce(MITAD);
    expect(screen.getByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(1);
    await escribirMonto('600000');

    await tocarGuardar();

    expect(await screen.findByText('50%')).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(progreso).toHaveBeenLastCalledWith('2026-09');
    expect(screen.getByText('$ 300.000')).toBeOnTheScreen();
    expect(screen.getByText('Te faltan $ 300.000 para tu meta')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.invitacion)).toBe(false);
    expect(screen.getByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF22-F24 al cambiar la meta, la tarjeta muestra el nuevo avance', async () => {
    await mostrar(META_MONTO, MITAD);
    progreso.mockResolvedValueOnce(EXCEDIDA);
    expect(screen.getByText('Te faltan $ 300.000 para tu meta')).toBeOnTheScreen();
    await escribirMonto('200000');

    await tocarGuardar();

    expect(await screen.findByText('150%')).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(screen.getByText(TEXTO.cumplida)).toBeOnTheScreen();
    expect(hayTexto(/Te faltan/)).toBe(false);
    expect(screen.getByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF22-F24 al tocar "Guardar meta" sin cambiar nada también se actualiza la tarjeta', async () => {
    await mostrar(META_MONTO, FALTAN_250);
    progreso.mockResolvedValueOnce(CUMPLIDA);

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.cumplida)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
  });

  it('CA-RF22-F25 al quitar la meta, la tarjeta vuelve a la invitación, sin porcentaje ni barra', async () => {
    await abrirDialogo();
    progreso.mockResolvedValueOnce(SIN_META);

    await fireEvent.press(boton('Quitar'));

    expect(await screen.findByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(progreso).toHaveBeenLastCalledWith('2026-09');
    expect(hayBarra()).toBe(false);
    expect(textoDeLaPantalla()).not.toMatch(/\d%/);
    expect(screen.getByText(TEXTO.quitada)).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('CA-RF22-F26 si la meta ya existía en el servidor (409 al crear) también se actualiza la tarjeta', async () => {
    obtener.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(META_MONTO);
    progreso.mockReset().mockResolvedValueOnce(SIN_META).mockResolvedValueOnce(FALTAN_250);
    crear.mockRejectedValueOnce(new ApiError(409, 'Ya existe una meta de ahorro para ese mes'));
    await render(<MetaDeAhorro />);
    await esperarCarga();
    await escribirMonto('900000');

    await tocarGuardar();

    expect(await screen.findByText('83%')).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(progreso).toHaveBeenLastCalledWith('2026-09');
  });

  it('CA-RF22-F26 si la meta ya no existía en el servidor (404 al editar) también se actualiza la tarjeta', async () => {
    await mostrar(META_MONTO, FALTAN_250);
    progreso.mockResolvedValueOnce(SIN_META);
    actualizar.mockRejectedValueOnce(new ApiError(404, 'Meta de ahorro no encontrada'));
    await escribirMonto('1800000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText('Esta meta ya no existe. Vuelve a guardarla para crearla de nuevo.'),
    ).toBeOnTheScreen();
  });

  it('CA-RF22-F26 si la meta ya estaba quitada (404 al quitar) también se actualiza la tarjeta', async () => {
    eliminar.mockRejectedValueOnce(new ApiError(404, 'Meta de ahorro no encontrada'));
    await abrirDialogo();
    progreso.mockResolvedValueOnce(SIN_META);

    await fireEvent.press(boton('Quitar'));

    expect(await screen.findByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(progreso).toHaveBeenCalledTimes(2);
  });

  const SIN_CAMBIO: [string, () => Promise<void>][] = [
    [
      'un monto vacío',
      async () => {
        await mostrar(null, FALTAN_250);
        await tocarGuardar();
        await screen.findByText(TEXTO.montoVacio);
      },
    ],
    [
      'un porcentaje en cero',
      async () => {
        await mostrar(null, FALTAN_250);
        await fireEvent.press(boton('Porcentaje'));
        await escribirPorcentaje('0');
        await tocarGuardar();
        await screen.findByText(TEXTO.porcentajeVacio);
      },
    ],
    [
      'un porcentaje de 150',
      async () => {
        await mostrar(null, FALTAN_250);
        await fireEvent.press(boton('Porcentaje'));
        await escribirPorcentaje('150');
        await tocarGuardar();
        await screen.findByText(TEXTO.porcentajeAlto);
      },
    ],
    ...(
      [
        ['sin conexión', new NetworkError(), TEXTO.red],
        ['un 400', new ApiError(400, 'x'), TEXTO.errorGuardar],
        ['un 422', new ApiError(422, 'x'), TEXTO.errorGuardar],
        ['un 500', new ApiError(500, 'x'), TEXTO.errorGuardar],
      ] as const
    ).map(([caso, error, aviso]): [string, () => Promise<void>] => [
      `guardar falla (${caso})`,
      async () => {
        crear.mockRejectedValueOnce(error);
        await mostrar(null, FALTAN_250);
        await escribirMonto('1500000');
        await tocarGuardar();
        await screen.findByText(aviso);
      },
    ]),
    [
      'guardar recibe un 401',
      async () => {
        crear.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
        await mostrar(null, FALTAN_250);
        await escribirMonto('1500000');
        await tocarGuardar();
        await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      },
    ],
    [
      'se toca "Cancelar" al quitar',
      async () => {
        await abrirDialogo();
        await fireEvent.press(boton('Cancelar'));
        await waitFor(() => expect(dialogoAbierto()).toBe(false));
      },
    ],
    ...(
      [
        ['409 con ahorro', new ApiError(409, 'x'), TEXTO.conAhorro],
        ['sin conexión', new NetworkError(), TEXTO.red],
        ['500', new ApiError(500, 'x'), TEXTO.errorQuitar],
      ] as const
    ).map(([caso, error, aviso]): [string, () => Promise<void>] => [
      `quitar falla (${caso})`,
      async () => {
        eliminar.mockRejectedValueOnce(error);
        await abrirDialogo();
        await fireEvent.press(boton('Quitar'));
        await screen.findByText(aviso);
      },
    ]),
    [
      'quitar recibe un 401',
      async () => {
        eliminar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
        await abrirDialogo();
        await fireEvent.press(boton('Quitar'));
        await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
      },
    ],
  ];

  it.each(SIN_CAMBIO)(
    'CA-RF22-F27 si la meta no cambió (%s) la tarjeta no se vuelve a pedir',
    async (_caso, accion) => {
      await accion();
      await esperarQueAsiente();

      expect(progreso).toHaveBeenCalledTimes(1);
    },
  );

  it('CA-RF22-F28 mientras se actualiza la tarjeta carga, sin cifras viejas, y el formulario ya muestra "Meta guardada."', async () => {
    await mostrar(META_MONTO, MITAD);
    const nuevo = pendiente<ProgresoAhorro>();
    progreso.mockReturnValueOnce(nuevo.promesa);
    await escribirMonto('200000');

    await tocarGuardar();

    expect(await screen.findByText(TEXTO.guardada)).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();
    expect(hayTexto('50%')).toBe(false);
    expect(hayTexto('Te faltan $ 300.000 para tu meta')).toBe(false);
    expect(hayBarra()).toBe(false);
    // El formulario no espera: se puede seguir usando
    expect(boton('Guardar meta')).toBeEnabled();
    await escribirMonto('250000');
    expect(campoMonto()).toHaveDisplayValue('$ 250.000');

    await act(async () => nuevo.resolver(EXCEDIDA));

    expect(await screen.findByText('150%')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargandoProgreso)).toBeNull();
  });

  it('CA-RF22-F28 un doble toque en "Guardar meta" produce una sola actualización de la tarjeta', async () => {
    await mostrar(META_MONTO, MITAD);
    const respuestaDeLaMeta = pendiente<MetaAhorro>();
    actualizar.mockReturnValueOnce(respuestaDeLaMeta.promesa);
    progreso.mockResolvedValueOnce(EXCEDIDA);
    await escribirMonto('200000');
    const guardar = boton('Guardar meta');

    await fireEvent.press(guardar);
    await fireEvent.press(guardar);
    await act(async () => respuestaDeLaMeta.resolver({ ...META_MONTO, valorObjetivo: 200000 }));
    await screen.findByText('150%');
    await esperarQueAsiente();

    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(progreso).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['500', new ApiError(500, 'x'), TEXTO.errorProgreso],
    ['sin conexión', new NetworkError(), TEXTO.red],
  ])(
    'CA-RF22-F29 si la actualización falla (%s) la tarjeta avisa y el formulario queda intacto',
    async (_caso, error, aviso) => {
      await mostrar(META_MONTO, MITAD);
      progreso.mockRejectedValueOnce(error).mockResolvedValueOnce(EXCEDIDA);
      await escribirMonto('200000');

      await tocarGuardar();

      expect(await screen.findByText(aviso)).toBeOnTheScreen();
      expect(boton(TEXTO.reintentarProgreso)).toBeOnTheScreen();
      expect(screen.getByText(TEXTO.guardada)).toBeOnTheScreen();
      // El aviso del formulario sigue siendo el de éxito: el único aviso de error es el de la tarjeta
      expect(screen.getAllByText(aviso)).toHaveLength(1);
      expect(hayTexto(TEXTO.errorGuardar)).toBe(false);
      expect(hayTexto(TEXTO.errorMeta)).toBe(false);
      expect(campoMonto()).toHaveDisplayValue('$ 200.000');

      await fireEvent.press(boton(TEXTO.reintentarProgreso));

      expect(await screen.findByText('150%')).toBeOnTheScreen();
      expect(progreso).toHaveBeenCalledTimes(3);
      expect(screen.getByText(TEXTO.guardada)).toBeOnTheScreen();
    },
  );

  it('CA-RF22-F30 si dos actualizaciones se cruzan, queda la última', async () => {
    await mostrar(null, SIN_META);
    const primera = pendiente<ProgresoAhorro>();
    const segunda = pendiente<ProgresoAhorro>();
    progreso.mockReturnValueOnce(primera.promesa).mockReturnValueOnce(segunda.promesa);
    await escribirMonto('600000');
    await tocarGuardar();
    await screen.findByText(TEXTO.guardada);
    await waitFor(() => expect(progreso).toHaveBeenCalledTimes(2));

    // Enseguida la quita: la actualización 2
    await fireEvent.press(boton('Quitar meta'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(progreso).toHaveBeenCalledTimes(3));

    await act(async () => segunda.resolver(SIN_META));
    expect(await screen.findByText(TEXTO.invitacion)).toBeOnTheScreen();
    // La respuesta tardía de la 1 (con meta) no pisa a la última
    await act(async () => primera.resolver(MITAD));
    await esperarQueAsiente();

    expect(screen.getByText(TEXTO.invitacion)).toBeOnTheScreen();
    expect(hayTexto('50%')).toBe(false);
    expect(hayBarra()).toBe(false);
  });
});

describe('Progreso del ahorro: accesibilidad y lenguaje (RNF-04, RNF-06, RNF-11)', () => {
  it('CA-RF22-F31 el indicador de carga se anuncia como "Cargando tu progreso de ahorro"', async () => {
    progreso.mockReturnValueOnce(pendiente<ProgresoAhorro>().promesa);

    await render(<MetaDeAhorro />);

    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();
  });

  it('CA-RF22-F31 la barra se anuncia como barra de progreso con su nombre y su valor de 0 a 100', async () => {
    await mostrar(META_MONTO, FALTAN_250);

    expect(barra()).toBeOnTheScreen();
    expect(barra()).toHaveAccessibilityValue({ now: 83 });
  });

  it('CA-RF22-F31 el aviso de error se anuncia como alerta y el botón como "Reintentar progreso de ahorro"', async () => {
    progreso.mockReset().mockRejectedValue(new ApiError(500, 'x'));

    await render(<MetaDeAhorro />);

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorProgreso);
    expect(boton(TEXTO.reintentarProgreso)).toBeOnTheScreen();
  });

  it('CA-RF22-F31 el mes, el ahorro, el porcentaje y los mensajes son texto, no solo color', async () => {
    await mostrar(META_MONTO, FALTAN_250);

    for (const texto of [
      TEXTO.mes,
      TEXTO.rotuloAhorro,
      '$ 1.250.000',
      '83%',
      'Te faltan $ 250.000 para tu meta',
    ]) {
      expect(screen.getByText(texto)).toBeOnTheScreen();
    }
    // El orden de lectura: mes, rótulo y ahorro, porcentaje y lo que falta
    const textos = textosEnOrden();
    const orden = [
      TEXTO.mes,
      TEXTO.rotuloAhorro,
      '$ 1.250.000',
      '83%',
      'Te faltan $ 250.000 para tu meta',
    ].map((t) => textos.indexOf(t));
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  const TECNICO =
    /disponible|ingresoPropio|egresos|periodo|porcentajeAvance|montoMeta|\bnull\b|undefined|NaN|Infinity|\b(400|401|500)\b/i;

  it.each([
    ['con meta', META_MONTO, FALTAN_250],
    ['cumplida', META_MONTO, CUMPLIDA],
    ['excedida', META_MONTO, EXCEDIDA],
    [
      'con ahorro negativo',
      META_MONTO,
      respuesta({ ahorroDelMes: -250000, disponible: -450000, porcentajeAvance: -125 }),
    ],
    ['sin meta', null, SIN_META],
    [
      'con meta sin porcentaje',
      META_MONTO,
      respuesta({ porcentajeAvance: null, meta: META_PORCENTAJE_DEL_PROGRESO }),
    ],
  ])(
    'CA-RF22-F32 los textos de la tarjeta %s son cotidianos y sin datos crudos',
    async (_caso, meta, datos) => {
      await mostrar(meta, datos);

      expect(textoDeLaTarjeta().length).toBeGreaterThan(0);
      expect(textoDeLaTarjeta()).not.toMatch(TECNICO);
    },
  );

  it.each([
    ['un error del servidor', new ApiError(500, 'Internal server error en montoMeta')],
    ['un error de parámetros', new ApiError(400, 'mes debe tener el formato YYYY-MM')],
    ['sin conexión', new NetworkError()],
  ])(
    'CA-RF22-F32 el aviso de %s habla con palabras cotidianas y no muestra mensajes del backend',
    async (_caso, error) => {
      progreso.mockReset().mockRejectedValue(error);

      await render(<MetaDeAhorro />);
      await screen.findByText(/Inténtalo de nuevo|No hay conexión/);

      const texto = textoDeLaTarjeta();
      expect(texto).not.toMatch(TECNICO);
      expect(texto).not.toMatch(/Internal|formato|YYYY/i);
    },
  );

  it('CA-RF22-F32 el indicador de carga no muestra textos técnicos', async () => {
    progreso.mockReturnValueOnce(pendiente<ProgresoAhorro>().promesa);

    await render(<MetaDeAhorro />);
    await screen.findByRole('button', { name: 'Guardar meta' });

    expect(screen.getByLabelText(TEXTO.cargandoProgreso)).toBeOnTheScreen();
    expect(textoDeLaTarjeta()).not.toMatch(TECNICO);
  });
});
