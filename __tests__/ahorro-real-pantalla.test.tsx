import MetaDeAhorro from '@/app/meta-de-ahorro';
import {
  actualizarMeta,
  crearMeta,
  eliminarMeta,
  guardarAhorroReal,
  obtenerAhorroAcumulado,
  obtenerMetaDelMes,
  obtenerProgresoAhorro,
  type AhorroAcumulado,
  type MetaAhorro,
  type ProgresoAhorro,
} from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  CON_TEXTO_GENERAL,
  conCodigo,
  desconocido,
  errorHttp,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import { boton, laHoja, pendiente, RED, textosEnOrden, VER_TODO } from './ayudas/tarjetas';

// Anotar el ahorro real y ver el acumulado en "Meta de ahorro" (criterios/04-ahorro-real.md, CA-RF23-F01 a F31).
// El backend se simula en el borde del adaptador (lib/api/ahorro) con metas en memoria que se comportan como el
// backend: el acumulado sale de lo guardado en cada meta. Hoy es el 17 de septiembre de 2026 (reloj simulado).
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/api/ahorro', () => ({
  obtenerMetaDelMes: jest.fn(),
  obtenerProgresoAhorro: jest.fn(),
  crearMeta: jest.fn(),
  actualizarMeta: jest.fn(),
  eliminarMeta: jest.fn(),
  obtenerAhorroAcumulado: jest.fn(),
  guardarAhorroReal: jest.fn(),
}));

const obtener = jest.mocked(obtenerMetaDelMes);
const progreso = jest.mocked(obtenerProgresoAhorro);
const crear = jest.mocked(crearMeta);
const actualizar = jest.mocked(actualizarMeta);
const eliminar = jest.mocked(eliminarMeta);
const acumulado = jest.mocked(obtenerAhorroAcumulado);
const guardar = jest.mocked(guardarAhorroReal);

const TEXTO = {
  seccion: 'Ahorro que has anotado',
  total: 'Total anotado',
  cargando: 'Cargando tu ahorro anotado',
  errorCarga: 'No pudimos cargar tu ahorro anotado. Inténtalo de nuevo en unos minutos.',
  vacio:
    'Todavía no hay meses con meta. Cuando fijes tu meta, podrás anotar aquí cuánto ahorraste.',
  reintentar: 'Reintentar ahorro anotado',
  pregunta: '¿Cuánto pudiste ahorrar?',
  ayuda: 'Es lo que de verdad lograste guardar ese mes. Lo escribes tú.',
  guardar: 'Guardar ahorro',
  borrar: 'Borrar lo anotado',
  campoVacio: 'Escribe cuánto ahorraste.',
  errorGuardar: 'No pudimos guardar tu ahorro. Inténtalo de nuevo en unos minutos.',
  sinMeta: 'Ese mes ya no tiene meta, así que no se puede anotar el ahorro.',
  dialogo: '¿Borrar lo anotado?',
  dialogoDetalle: 'Se borrará el ahorro anotado de junio 2026. La meta de ese mes no cambia.',
  errorBorrar: 'No pudimos borrar lo anotado. Inténtalo de nuevo en unos minutos.',
  conAhorro:
    'Ya anotaste ahorro en este mes, así que la meta no se puede quitar. Borra primero lo anotado.',
};
const ANOTAR_AGOSTO = 'Anotar el ahorro de agosto 2026';
const CAMBIAR_SEPTIEMBRE = 'Cambiar el ahorro de septiembre 2026';
const CAMBIAR_JUNIO = 'Cambiar el ahorro de junio 2026';

// --- El backend simulado ---

const metaDe = (id: string, periodo: string, ahorroReal: number): MetaAhorro => ({
  id,
  tipoMeta: 'MONTO_FIJO',
  valorObjetivo: 1500000,
  periodo,
  ahorroReal,
  creadaEn: `${periodo}-01T10:00:00.000Z`,
  actualizadaEn: `${periodo}-01T10:00:00.000Z`,
});
// Julio no tiene meta. Acumulado: junio 250.000, agosto 250.000, septiembre 400.000
const JUNIO = metaDe('meta-junio', '2026-06', 250000);
const AGOSTO = metaDe('meta-agosto', '2026-08', 0);
const SEPTIEMBRE = metaDe('meta-septiembre', '2026-09', 150000);

let metas: MetaAhorro[] = [];
const sembrar = (...nuevas: MetaAhorro[]) => {
  metas = nuevas.map((m) => ({ ...m }));
};
const quitarDelServidor = (id: string) => {
  metas = metas.filter((m) => m.id !== id);
};

function acumuladoDelServidor(hasta: string): AhorroAcumulado {
  let total = 0;
  const meses = metas
    .filter((m) => m.periodo <= hasta)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map(({ periodo, ahorroReal }) => {
      total += ahorroReal;
      return { periodo, ahorroReal, acumulado: total };
    });
  return { total, meses };
}

function progresoDelServidor(mes: string): ProgresoAhorro {
  const meta = metas.find((m) => m.periodo === mes);
  const montoMeta = meta?.valorObjetivo ?? 0;
  return {
    periodo: mes,
    ingresoPropio: 4500000,
    egresos: 3250000,
    ahorroDelMes: 1250000,
    meta: meta
      ? { id: meta.id, tipoMeta: meta.tipoMeta, valorObjetivo: meta.valorObjetivo, montoMeta }
      : null,
    disponible: 1250000 - montoMeta,
    porcentajeAvance: montoMeta ? (1250000 / montoMeta) * 100 : null,
  };
}

function buscar(id: string) {
  const meta = metas.find((m) => m.id === id);
  if (!meta) throw new ApiError(404, 'Meta de ahorro no encontrada');
  return meta;
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
  sembrar(JUNIO, AGOSTO, SEPTIEMBRE);
  obtener.mockReset().mockImplementation(async (mes) => {
    const meta = metas.find((m) => m.periodo === mes);
    return meta ? { ...meta } : null;
  });
  progreso.mockReset().mockImplementation(async (mes) => progresoDelServidor(mes));
  acumulado.mockReset().mockImplementation(async (hasta) => acumuladoDelServidor(hasta));
  guardar.mockReset().mockImplementation(async (id, ahorroReal) => {
    const meta = buscar(id);
    meta.ahorroReal = ahorroReal;
    return { ...meta };
  });
  crear.mockReset().mockImplementation(async (datos) => {
    const meta = { ...metaDe('meta-nueva', datos.periodo, 0), ...datos };
    metas.push(meta);
    return { ...meta };
  });
  actualizar
    .mockReset()
    .mockImplementation(async (id, datos) => ({ ...Object.assign(buscar(id), datos) }));
  eliminar.mockReset().mockImplementation(async (id) => {
    if (buscar(id).ahorroReal !== 0)
      throw new ApiError(409, 'No se puede eliminar una meta que ya tiene ahorro registrado');
    quitarDelServidor(id);
  });
});
afterEach(() => {
  jest.useRealTimers();
});

// --- Ayudas de pantalla ---

const hayTexto = (texto: string | RegExp) => screen.queryByText(texto, VER_TODO) !== null;
const hayBoton = (nombre: string | RegExp) =>
  screen.queryByRole('button', { name: nombre, ...VER_TODO }) !== null;
const hayAlerta = () => screen.queryByRole('alert', VER_TODO) !== null;
const indicador = () => screen.queryByLabelText(TEXTO.cargando);
const hojaAbierta = (mes: string) => hayTexto(`Ahorro de ${mes}`);
const dialogoAbierto = () => hayTexto(TEXTO.dialogo);
const filas = () => screen.queryAllByRole('button', { name: /el ahorro de/, ...VER_TODO });

/** Lo que se lee desde el título de la sección hasta el final, sin importar cómo se parta en elementos. */
function textoDeLaSeccion() {
  const textos = textosEnOrden().join('');
  const inicio = textos.indexOf(TEXTO.seccion);
  expect(inicio).toBeGreaterThanOrEqual(0);
  return textos.slice(inicio);
}
/** Los fragmentos aparecen en ese orden. */
function enOrden(texto: string, fragmentos: string[]) {
  let desde = 0;
  for (const fragmento of fragmentos) {
    const posicion = texto.indexOf(fragmento, desde);
    expect({ fragmento, aparece: posicion >= 0 }).toEqual({ fragmento, aparece: true });
    desde = posicion + fragmento.length;
  }
}

// Dentro de la hoja o del diálogo que está encima (el formulario de la meta también tiene "Monto en pesos")
const campo = () => laHoja().getByLabelText('Monto en pesos');
const enLaHoja = (nombre: string) => laHoja().getByRole('button', { name: nombre });
const escribir = (texto: string) => fireEvent.changeText(campo(), texto);
const tocarGuardar = () => fireEvent.press(enLaHoja(TEXTO.guardar));
const alertaEncima = (texto: string) =>
  waitFor(() => expect(laHoja().getByRole('alert')).toHaveTextContent(texto));

async function mostrar() {
  await render(<MetaDeAhorro />);
  await screen.findByRole('button', { name: 'Guardar meta' });
  await waitFor(() => expect(acumulado).toHaveBeenCalled());
  await waitFor(() => expect(indicador()).toBeNull());
}
async function abrirHoja(nombre = ANOTAR_AGOSTO) {
  await fireEvent.press(await screen.findByRole('button', { name: nombre }));
  await screen.findByRole('button', { name: TEXTO.guardar });
}
async function mostrarHoja(nombre = ANOTAR_AGOSTO) {
  await mostrar();
  await abrirHoja(nombre);
}
async function mostrarDialogo() {
  await mostrarHoja(CAMBIAR_JUNIO);
  await fireEvent.press(enLaHoja(TEXTO.borrar));
  await screen.findByText(TEXTO.dialogo);
}
/** Deja que termine todo lo que está en vuelo (una llamada de más se vería aquí). */
async function asentar() {
  await act(async () => {});
  await act(async () => {});
}

describe('Ahorro anotado: consultar y ver', () => {
  it('CA-RF23-F01 la sección "Ahorro que has anotado" va después de la tarjeta de progreso y del formulario de la meta', async () => {
    await mostrar();

    expect(await screen.findByText(TEXTO.seccion)).toBeOnTheScreen();
    enOrden(textosEnOrden().join(''), [
      'Septiembre 2026',
      'Meta mensual',
      'Guardar meta',
      'Quitar meta',
      TEXTO.seccion,
      TEXTO.total,
    ]);
  });

  it('CA-RF23-F02 al entrar pide el acumulado hasta el mes actual una sola vez, a la vez que la meta y el progreso', async () => {
    const deLaMeta = pendiente<MetaAhorro | null>();
    const delProgreso = pendiente<ProgresoAhorro>();
    obtener.mockReturnValueOnce(deLaMeta.promesa);
    progreso.mockReturnValueOnce(delProgreso.promesa);

    await render(<MetaDeAhorro />);

    // Las tres salieron sin que la meta ni el progreso hayan respondido
    expect(acumulado).toHaveBeenCalledTimes(1);
    expect(acumulado).toHaveBeenCalledWith('2026-09');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(progreso).toHaveBeenCalledTimes(1);
    // Y la sección no espera a las otras dos para mostrar lo suyo
    expect(await screen.findByText(TEXTO.total)).toBeOnTheScreen();

    await act(async () => {
      deLaMeta.resolver({ ...SEPTIEMBRE });
      delProgreso.resolver(progresoDelServidor('2026-09'));
    });
    await asentar();

    expect(acumulado).toHaveBeenCalledTimes(1);
  });

  it('CA-RF23-F03 muestra el total y una fila por mes, del más reciente al más antiguo, sin los meses sin meta', async () => {
    await mostrar();
    await screen.findByText(TEXTO.total);

    enOrden(textoDeLaSeccion(), [
      TEXTO.total,
      '$ 400.000',
      'septiembre 2026',
      'Anotaste $ 150.000',
      'Llevas $ 400.000',
      'agosto 2026',
      'Sin anotar',
      'Llevas $ 250.000',
      'junio 2026',
      'Anotaste $ 250.000',
      'Llevas $ 250.000',
    ]);
    expect(screen.getByText('$ 400.000')).toBeOnTheScreen();
    expect(screen.getByText('Anotaste $ 150.000')).toBeOnTheScreen();
    expect(screen.getByText('Sin anotar')).toBeOnTheScreen();
    expect(screen.getByText('Llevas $ 400.000')).toBeOnTheScreen();
    expect(screen.getAllByText('Llevas $ 250.000')).toHaveLength(2);
    expect(hayTexto(/julio/i)).toBe(false);
    expect(filas()).toHaveLength(3);
  });

  it('CA-RF23-F04 las filas sin ahorro tienen "Anotar" y las demás "Cambiar"', async () => {
    await mostrar();

    expect(await screen.findByRole('button', { name: ANOTAR_AGOSTO })).toBeOnTheScreen();
    expect(boton(CAMBIAR_SEPTIEMBRE)).toBeOnTheScreen();
    expect(boton(CAMBIAR_JUNIO)).toBeOnTheScreen();
    expect(screen.getAllByText('Anotar')).toHaveLength(1);
    expect(screen.getAllByText('Cambiar')).toHaveLength(2);
    expect(hayBoton('Cambiar el ahorro de agosto 2026')).toBe(false);
    expect(hayBoton('Anotar el ahorro de junio 2026')).toBe(false);
  });

  it('CA-RF23-F05 redondea al peso al mostrar y escribe los negativos con signo', async () => {
    sembrar(metaDe('meta-agosto', '2026-08', -80000.4));
    await mostrar();

    expect(await screen.findByText('Anotaste -$ 80.000')).toBeOnTheScreen();
    expect(screen.getByText('Llevas -$ 80.000')).toBeOnTheScreen();
    expect(screen.getByText('-$ 80.000')).toBeOnTheScreen();
    expect(boton('Cambiar el ahorro de agosto 2026')).toBeOnTheScreen();
    expect(textoDeLaSeccion()).not.toMatch(/\d,\d|NaN/);
  });

  it('CA-RF23-F05 un valor que se redondea a cero nunca se escribe "-$ 0"', async () => {
    sembrar(metaDe('meta-agosto', '2026-08', -0.3));
    await mostrar();
    await screen.findByText(TEXTO.total);

    expect(textoDeLaSeccion()).not.toMatch(/-\$ 0|-0|\d,\d|NaN/);
    expect(screen.getByText('$ 0')).toBeOnTheScreen();
  });

  it('CA-RF23-F06 muestra las cifras que llegan aunque no cuadren: no suma los meses', async () => {
    const respuesta = acumuladoDelServidor('2026-09');
    respuesta.total = 999999;
    respuesta.meses[2].acumulado = 5;
    acumulado.mockResolvedValue(respuesta);
    await mostrar();

    expect(await screen.findByText('$ 999.999')).toBeOnTheScreen();
    expect(screen.getByText('Llevas $ 5')).toBeOnTheScreen();
    expect(hayTexto('$ 400.000')).toBe(false);
    expect(hayTexto('Llevas $ 400.000')).toBe(false);
  });

  it('CA-RF23-F07 sin meses con meta lo explica, sin total, sin filas y sin aviso de error', async () => {
    sembrar();
    await mostrar();

    expect(await screen.findByText(TEXTO.vacio)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.seccion)).toBeOnTheScreen();
    expect(hayTexto(TEXTO.total)).toBe(false);
    expect(filas()).toHaveLength(0);
    expect(hayAlerta()).toBe(false);
  });
});

describe('Ahorro anotado: carga y errores', () => {
  it('CA-RF23-F08 mientras carga solo se ve su indicador, y la tarjeta y el formulario se muestran aparte', async () => {
    const carga = pendiente<AhorroAcumulado>();
    acumulado.mockReturnValueOnce(carga.promesa);
    await render(<MetaDeAhorro />);
    await screen.findByRole('button', { name: 'Guardar meta' });

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(await screen.findByText('Septiembre 2026')).toBeOnTheScreen();
    expect(hayTexto(TEXTO.total)).toBe(false);
    expect(hayTexto(TEXTO.vacio)).toBe(false);
    expect(hayTexto(TEXTO.errorCarga)).toBe(false);
    expect(filas()).toHaveLength(0);
    expect(hayAlerta()).toBe(false);

    await act(async () => carga.resolver(acumuladoDelServidor('2026-09')));

    expect(await screen.findByText(TEXTO.total)).toBeOnTheScreen();
    expect(indicador()).toBeNull();
  });

  it.each([400, 500])(
    'CA-RF23-F09 ante un %s avisa en la sección y "Reintentar" vuelve a pedir solo lo suyo',
    async (status) => {
      const segunda = pendiente<AhorroAcumulado>();
      acumulado
        .mockRejectedValueOnce(new ApiError(status, 'hasta debe tener el formato YYYY-MM'))
        .mockReturnValueOnce(segunda.promesa);
      await mostrar();

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorCarga);
      expect(boton(TEXTO.reintentar)).toBeOnTheScreen();
      expect(screen.getByText('Reintentar')).toBeOnTheScreen();
      expect(hayTexto(/formato|YYYY/)).toBe(false);
      expect(hayTexto(TEXTO.total)).toBe(false);
      expect(boton('Guardar meta')).toBeEnabled();
      expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();

      await fireEvent.press(boton(TEXTO.reintentar));

      expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
      expect(hayTexto(TEXTO.errorCarga)).toBe(false);
      expect(acumulado).toHaveBeenCalledTimes(2);
      expect(acumulado).toHaveBeenLastCalledWith('2026-09');
      expect(obtener).toHaveBeenCalledTimes(1);
      expect(progreso).toHaveBeenCalledTimes(1);

      await act(async () => segunda.resolver(acumuladoDelServidor('2026-09')));

      expect(await screen.findByRole('button', { name: CAMBIAR_JUNIO })).toBeOnTheScreen();
      expect(hayAlerta()).toBe(false);
    },
  );

  it('CA-RF23-F10 sin conexión lo explica en la sección, con "Reintentar"', async () => {
    acumulado.mockRejectedValue(new NetworkError());
    await mostrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(RED);
    expect(boton(TEXTO.reintentar)).toBeOnTheScreen();
    expect(boton('Guardar meta')).toBeOnTheScreen();
  });

  it('CA-RF23-F11 ante un 401 la sección no muestra un aviso propio', async () => {
    acumulado.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));
    await render(<MetaDeAhorro />);
    await screen.findByRole('button', { name: 'Guardar meta' });
    await asentar();

    expect(acumulado).toHaveBeenCalledWith('2026-09');
    expect(hayAlerta()).toBe(false);
    expect(hayTexto(TEXTO.errorCarga)).toBe(false);
    expect(hayBoton(TEXTO.reintentar)).toBe(false);
  });
});

describe('Ahorro anotado: la hoja del mes', () => {
  it('CA-RF23-F12 "Anotar" abre la hoja del mes con el campo vacío y sus textos, sin llamar al backend', async () => {
    await mostrarHoja();

    expect(screen.getByText('Ahorro de agosto 2026')).toBeOnTheScreen();
    expect(laHoja().getByText(TEXTO.pregunta)).toBeOnTheScreen();
    expect(laHoja().getByText(TEXTO.ayuda)).toBeOnTheScreen();
    expect(campo()).toHaveDisplayValue('');
    expect(campo().props.placeholder).toBe('$ 0');
    expect(enLaHoja(TEXTO.guardar)).toBeOnTheScreen();
    expect(enLaHoja('Volver')).toBeOnTheScreen();
    expect(hayBoton(TEXTO.borrar)).toBe(false);
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(acumulado).toHaveBeenCalledTimes(1);
    expect(guardar).not.toHaveBeenCalled();
  });

  it.each([
    [CAMBIAR_SEPTIEMBRE, 'septiembre 2026', '$ 150.000'],
    [CAMBIAR_JUNIO, 'junio 2026', '$ 250.000'],
  ])(
    'CA-RF23-F12 el mes actual y los anteriores se abren igual: "%s"',
    async (nombre, mes, valor) => {
      await mostrarHoja(nombre);

      expect(hojaAbierta(mes)).toBe(true);
      expect(campo()).toHaveDisplayValue(valor);
      expect(obtener).toHaveBeenCalledTimes(1);
    },
  );

  it('CA-RF23-F13 con ahorro anotado el campo lo trae y se ve "Borrar lo anotado"', async () => {
    await mostrarHoja(CAMBIAR_JUNIO);

    expect(campo()).toHaveDisplayValue('$ 250.000');
    expect(enLaHoja(TEXTO.borrar)).toBeOnTheScreen();
  });

  it('CA-RF23-F13 si lo anotado es negativo el campo empieza vacío y también se ve "Borrar lo anotado"', async () => {
    sembrar(metaDe('meta-agosto', '2026-08', -80000));
    await mostrarHoja('Cambiar el ahorro de agosto 2026');

    expect(campo()).toHaveDisplayValue('');
    expect(enLaHoja(TEXTO.borrar)).toBeOnTheScreen();
  });

  it('CA-RF23-F14 el campo solo deja pesos enteros, con puntos de miles', async () => {
    await mostrarHoja();

    await escribir('-abc1250000');

    expect(campo()).toHaveDisplayValue('$ 1.250.000');
  });

  it.each([
    ['vacío', ANOTAR_AGOSTO, ''],
    ['en "0"', ANOTAR_AGOSTO, '0'],
    ['borrado en un mes que ya tenía ahorro', CAMBIAR_JUNIO, ''],
  ])('CA-RF23-F15 con el campo %s avisa y no llama al backend', async (_caso, nombre, texto) => {
    await mostrarHoja(nombre);
    await escribir(texto);

    await tocarGuardar();

    await alertaEncima(TEXTO.campoVacio);
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(guardar).not.toHaveBeenCalled();

    await escribir('5000');

    expect(hayTexto(TEXTO.campoVacio)).toBe(false);
    expect(hayAlerta()).toBe(false);
  });

  it.each([
    [ANOTAR_AGOSTO, 'agosto 2026', ''],
    [CAMBIAR_JUNIO, 'junio 2026', '$ 250.000'],
  ])(
    'CA-RF23-F16 "Volver" no guarda y al volver a abrir (%s) el campo trae lo guardado',
    async (nombre, mes, guardado) => {
      await mostrarHoja(nombre);
      await escribir('999000');

      await fireEvent.press(enLaHoja('Volver'));

      await waitFor(() => expect(hojaAbierta(mes)).toBe(false));
      expect(guardar).not.toHaveBeenCalled();
      expect(acumulado).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Sin anotar')).toBeOnTheScreen();
      expect(screen.getByText('Anotaste $ 250.000')).toBeOnTheScreen();

      await abrirHoja(nombre);

      expect(campo()).toHaveDisplayValue(guardado);
    },
  );
});

describe('Ahorro anotado: guardar', () => {
  it('CA-RF23-F17 anota el valor en la meta de ese mes, como número y una sola vez', async () => {
    await mostrarHoja();
    await escribir('320000');

    await tocarGuardar();

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(obtener).toHaveBeenLastCalledWith('2026-08');
    expect(guardar).toHaveBeenCalledWith('meta-agosto', 320000);
    await asentar();
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF23-F18 al guardar cierra la hoja y actualiza el acumulado sin ocultar las cifras anteriores', async () => {
    await mostrarHoja();
    await escribir('320000');
    const nueva = pendiente<AhorroAcumulado>();
    acumulado.mockReturnValueOnce(nueva.promesa);

    await tocarGuardar();

    await waitFor(() => expect(hojaAbierta('agosto 2026')).toBe(false));
    expect(acumulado).toHaveBeenCalledTimes(2);
    expect(acumulado).toHaveBeenLastCalledWith('2026-09');
    // Mientras llega la respuesta: lo de antes, sin indicador
    expect(screen.getByText('$ 400.000')).toBeOnTheScreen();
    expect(screen.getByText('Sin anotar')).toBeOnTheScreen();
    expect(indicador()).toBeNull();

    await act(async () => nueva.resolver(acumuladoDelServidor('2026-09')));

    expect(await screen.findByText('Anotaste $ 320.000')).toBeOnTheScreen();
    expect(screen.getByText('$ 720.000')).toBeOnTheScreen();
    expect(screen.getByText('Llevas $ 570.000')).toBeOnTheScreen();
    expect(screen.getByText('Llevas $ 720.000')).toBeOnTheScreen();
    expect(hayTexto('Sin anotar')).toBe(false);
    expect(boton('Cambiar el ahorro de agosto 2026')).toBeOnTheScreen();
    // La meta y el progreso no se vuelven a pedir (la segunda consulta de meta fue la de agosto, para su id)
    expect(obtener.mock.calls).toEqual([['2026-09'], ['2026-08']]);
    expect(progreso).toHaveBeenCalledTimes(1);
  });

  it('CA-RF23-F19 guardar sin cambiar nada solo cierra la hoja', async () => {
    await mostrarHoja(CAMBIAR_JUNIO);

    await tocarGuardar();

    await waitFor(() => expect(hojaAbierta('junio 2026')).toBe(false));
    await asentar();
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(guardar).not.toHaveBeenCalled();
    expect(acumulado).toHaveBeenCalledTimes(1);
  });

  it('CA-RF23-F20 mientras guarda muestra un indicador y dos toques envían una sola vez', async () => {
    await mostrarHoja();
    await escribir('320000');
    const respuesta = pendiente<MetaAhorro>();
    guardar.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = enLaHoja(TEXTO.guardar);

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(laHoja().queryByText(TEXTO.guardar)).toBeNull();
    expect(botonGuardar).toBeDisabled();
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    await act(async () => respuesta.resolver({ ...AGOSTO, ahorroReal: 320000 }));
    await waitFor(() => expect(hojaAbierta('agosto 2026')).toBe(false));
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF23-F20 también protege el doble toque mientras consulta la meta del mes', async () => {
    await mostrarHoja();
    await escribir('320000');
    const consulta = pendiente<MetaAhorro | null>();
    obtener.mockReturnValueOnce(consulta.promesa);
    const botonGuardar = enLaHoja(TEXTO.guardar);

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(botonGuardar).toBeDisabled();
    expect(obtener).toHaveBeenCalledTimes(2);
    await act(async () => consulta.resolver({ ...AGOSTO }));
    await waitFor(() => expect(hojaAbierta('agosto 2026')).toBe(false));
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  /** Hace fallar una vez la consulta de la meta del mes o el guardado. */
  const fallar = (donde: 'consultar' | 'guardar', error: Error) =>
    donde === 'consultar'
      ? obtener.mockRejectedValueOnce(error)
      : guardar.mockRejectedValueOnce(error);

  it.each([
    ['CA-RF23-F21', 'sin conexión al consultar la meta', 'consultar', new NetworkError(), RED],
    ['CA-RF23-F21', 'sin conexión al guardar', 'guardar', new NetworkError(), RED],
    [
      'CA-RF23-F22',
      'un 500 al consultar la meta',
      'consultar',
      new ApiError(500, 'Internal server error'),
      TEXTO.errorGuardar,
    ],
    [
      'CA-RF23-F22',
      'un 500 al guardar',
      'guardar',
      new ApiError(500, 'Internal server error'),
      TEXTO.errorGuardar,
    ],
    [
      'CA-RF23-F22',
      'un 400 al guardar',
      'guardar',
      new ApiError(400, 'ahorroReal debe ser un número'),
      TEXTO.errorGuardar,
    ],
  ] as const)(
    '%s ante %s avisa en la hoja, conserva lo escrito y deja reintentar',
    async (_id, _caso, donde, error, aviso) => {
      await mostrarHoja();
      await escribir('320000');
      fallar(donde, error);

      await tocarGuardar();

      await alertaEncima(aviso);
      expect(hojaAbierta('agosto 2026')).toBe(true);
      expect(campo()).toHaveDisplayValue('$ 320.000');
      expect(hayTexto(error.message)).toBe(false);

      await tocarGuardar();

      await waitFor(() => expect(hojaAbierta('agosto 2026')).toBe(false));
      expect(guardar).toHaveBeenLastCalledWith('meta-agosto', 320000);
      expect(await screen.findByText('Anotaste $ 320.000')).toBeOnTheScreen();
    },
  );

  it('CA-RF23-F23 si el mes ya no tiene meta al consultarla, lo explica, no guarda y actualiza el acumulado', async () => {
    await mostrarHoja();
    await escribir('320000');
    quitarDelServidor('meta-agosto');

    await tocarGuardar();

    await alertaEncima(TEXTO.sinMeta);
    expect(guardar).not.toHaveBeenCalled();
    expect(hojaAbierta('agosto 2026')).toBe(true);
    await waitFor(() => expect(hayBoton(ANOTAR_AGOSTO)).toBe(false));
    expect(acumulado).toHaveBeenCalledTimes(2);
  });

  it('CA-RF23-F23 si guardar responde 404, lo explica y actualiza el acumulado', async () => {
    await mostrarHoja();
    await escribir('320000');
    guardar.mockImplementationOnce(async (id) => {
      quitarDelServidor(id);
      throw new ApiError(404, 'Meta de ahorro no encontrada');
    });

    await tocarGuardar();

    await alertaEncima(TEXTO.sinMeta);
    expect(hojaAbierta('agosto 2026')).toBe(true);
    expect(hayTexto('Meta de ahorro no encontrada')).toBe(false);
    await waitFor(() => expect(hayBoton(ANOTAR_AGOSTO)).toBe(false));
    expect(acumulado).toHaveBeenCalledTimes(2);
  });

  it.each(['consultar', 'guardar'] as const)(
    'CA-RF23-F24 ante un 401 al %s la hoja no muestra un aviso propio',
    async (donde) => {
      await mostrarHoja();
      await escribir('320000');
      fallar(donde, new ApiError(401, 'Sesión inválida o vencida'));

      await tocarGuardar();
      await asentar();

      expect(obtener).toHaveBeenCalledTimes(2);
      expect(hayAlerta()).toBe(false);
      expect(hayTexto(TEXTO.errorGuardar)).toBe(false);
      expect(hayTexto(TEXTO.sinMeta)).toBe(false);
    },
  );
});

describe('Ahorro anotado: borrar lo anotado', () => {
  it('CA-RF23-F25 "Borrar lo anotado" pide confirmación sin enviar nada, y "Cancelar" deja la hoja como estaba', async () => {
    await mostrarDialogo();

    expect(laHoja().getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(laHoja().getByText(TEXTO.dialogoDetalle)).toBeOnTheScreen();
    expect(enLaHoja('Cancelar')).toBeOnTheScreen();
    expect(enLaHoja('Eliminar')).toBeOnTheScreen();
    expect(guardar).not.toHaveBeenCalled();

    await fireEvent.press(enLaHoja('Cancelar'));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(hojaAbierta('junio 2026')).toBe(true);
    expect(campo()).toHaveDisplayValue('$ 250.000');
    expect(guardar).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF23-F26 confirmar envía 0 una sola vez, cierra diálogo y hoja, y actualiza el acumulado', async () => {
    await mostrarDialogo();
    const respuesta = pendiente<MetaAhorro>();
    guardar.mockImplementationOnce((id, ahorroReal) => {
      buscar(id).ahorroReal = ahorroReal;
      return respuesta.promesa;
    });
    const confirmar = enLaHoja('Eliminar');

    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    expect(laHoja().queryByText('Eliminar')).toBeNull();
    expect(confirmar).toBeDisabled();
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(obtener).toHaveBeenLastCalledWith('2026-06');
    expect(guardar).toHaveBeenCalledWith('meta-junio', 0);

    await act(async () => respuesta.resolver({ ...JUNIO, ahorroReal: 0 }));

    await waitFor(() => expect(dialogoAbierto()).toBe(false));
    expect(hojaAbierta('junio 2026')).toBe(false);
    expect(
      await screen.findByRole('button', { name: 'Anotar el ahorro de junio 2026' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('$ 150.000')).toBeOnTheScreen();
    expect(acumulado).toHaveBeenCalledTimes(2);
    expect(acumulado).toHaveBeenLastCalledWith('2026-09');
    // Borrar lo anotado no quita la meta
    expect(eliminar).not.toHaveBeenCalled();
  });

  it.each(['la consulta no encuentra la meta', 'guardar responde 404'])(
    'CA-RF23-F26 si la meta ya no existe (%s) cierra todo y actualiza, sin aviso de error',
    async (caso) => {
      await mostrarDialogo();
      if (caso === 'guardar responde 404') {
        guardar.mockImplementationOnce(async (id) => {
          quitarDelServidor(id);
          throw new ApiError(404, 'Meta de ahorro no encontrada');
        });
      } else quitarDelServidor('meta-junio');

      await fireEvent.press(enLaHoja('Eliminar'));

      await waitFor(() => expect(dialogoAbierto()).toBe(false));
      expect(hojaAbierta('junio 2026')).toBe(false);
      await waitFor(() => expect(hayBoton(CAMBIAR_JUNIO)).toBe(false));
      expect(acumulado).toHaveBeenCalledTimes(2);
      expect(hayAlerta()).toBe(false);
    },
  );

  it.each([
    ['sin conexión al consultar la meta', 'consultar', new NetworkError(), RED],
    ['sin conexión al guardar', 'guardar', new NetworkError(), RED],
    ['un 500 al guardar', 'guardar', new ApiError(500, 'x'), TEXTO.errorBorrar],
  ] as const)(
    'CA-RF23-F27 ante %s avisa dentro del diálogo y deja intentarlo otra vez',
    async (_caso, donde, error, aviso) => {
      await mostrarDialogo();
      if (donde === 'consultar') obtener.mockRejectedValueOnce(error);
      else guardar.mockRejectedValueOnce(error);

      await fireEvent.press(enLaHoja('Eliminar'));

      await alertaEncima(aviso);
      expect(dialogoAbierto()).toBe(true);

      await fireEvent.press(enLaHoja('Eliminar'));

      await waitFor(() => expect(dialogoAbierto()).toBe(false));
      expect(guardar).toHaveBeenLastCalledWith('meta-junio', 0);
    },
  );

  it('CA-RF23-F27 ante un 401 no muestra un aviso propio', async () => {
    await mostrarDialogo();
    guardar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await fireEvent.press(enLaHoja('Eliminar'));
    await asentar();

    expect(guardar).toHaveBeenCalledTimes(1);
    expect(hayAlerta()).toBe(false);
    expect(hayTexto(TEXTO.errorBorrar)).toBe(false);
  });
});

describe('Ahorro anotado: relación con la meta del mes', () => {
  const montoDeLaMeta = () => screen.getByLabelText('Monto en pesos');
  const guardarMeta = () => fireEvent.press(boton('Guardar meta'));
  async function quitarMeta() {
    await fireEvent.press(boton('Quitar meta'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Quitar' }));
  }

  it('CA-RF23-F28 al fijar la meta se vuelve a pedir el acumulado y aparece la fila del mes', async () => {
    sembrar(JUNIO, AGOSTO);
    await mostrar();
    await screen.findByText(TEXTO.total);
    expect(hayTexto('septiembre 2026')).toBe(false);
    await fireEvent.changeText(montoDeLaMeta(), '1500000');

    await guardarMeta();

    expect(
      await screen.findByRole('button', { name: 'Anotar el ahorro de septiembre 2026' }),
    ).toBeOnTheScreen();
    expect(acumulado).toHaveBeenCalledTimes(2);
    expect(acumulado).toHaveBeenLastCalledWith('2026-09');
  });

  it('CA-RF23-F28 al quitar la meta se vuelve a pedir el acumulado y desaparece la fila del mes', async () => {
    sembrar(JUNIO, { ...SEPTIEMBRE, ahorroReal: 0 });
    await mostrar();
    await screen.findByText('septiembre 2026');

    await quitarMeta();

    await waitFor(() => expect(hayTexto('septiembre 2026')).toBe(false));
    expect(screen.getByText('junio 2026')).toBeOnTheScreen();
    expect(acumulado).toHaveBeenCalledTimes(2);
    expect(acumulado).toHaveBeenLastCalledWith('2026-09');
  });

  it.each(['la validación', 'sin conexión', 'un 500'])(
    'CA-RF23-F28 si guardar la meta falla por %s no se vuelve a pedir el acumulado',
    async (causa) => {
      sembrar(JUNIO);
      await mostrar();
      await screen.findByText(TEXTO.total);
      if (causa !== 'la validación') {
        crear.mockRejectedValueOnce(
          causa === 'un 500' ? new ApiError(500, 'x') : new NetworkError(),
        );
        await fireEvent.changeText(montoDeLaMeta(), '1500000');
      }

      await guardarMeta();
      await screen.findByRole('alert');
      await asentar();

      expect(acumulado).toHaveBeenCalledTimes(1);
    },
  );

  it('CA-RF23-F29 una meta con ahorro anotado no se puede quitar y se explica qué hacer', async () => {
    await mostrar();
    await screen.findByText(TEXTO.total);

    await quitarMeta();

    await alertaEncima(TEXTO.conAhorro);
    expect(eliminar).toHaveBeenCalledWith('meta-septiembre');
    await fireEvent.press(enLaHoja('Cancelar'));
    await waitFor(() => expect(hayTexto('¿Quitar tu meta de ahorro?')).toBe(false));
    expect(boton('Quitar meta')).toBeOnTheScreen();
    expect(screen.getByText('Anotaste $ 150.000')).toBeOnTheScreen();
  });
});

describe('Ahorro anotado: accesibilidad y lenguaje (RNF-04, RNF-06)', () => {
  it('CA-RF23-F30 el total y cada fila se leen en una sola frase y cada botón dice su mes', async () => {
    await mostrar();

    expect(await screen.findByLabelText('Total anotado, $ 400.000')).toBeOnTheScreen();
    for (const frase of [
      'septiembre 2026, anotaste $ 150.000, llevas $ 400.000',
      'agosto 2026, sin anotar, llevas $ 250.000',
      'junio 2026, anotaste $ 250.000, llevas $ 250.000',
    ]) {
      expect(screen.getByLabelText(frase)).toBeOnTheScreen();
    }
    for (const nombre of [CAMBIAR_SEPTIEMBRE, ANOTAR_AGOSTO, CAMBIAR_JUNIO]) {
      expect(boton(nombre)).toBeOnTheScreen();
    }
  });

  it('CA-RF23-F30 la hoja y el diálogo anuncian sus botones, su campo y sus avisos', async () => {
    await mostrarHoja(CAMBIAR_JUNIO);

    for (const nombre of [TEXTO.guardar, TEXTO.borrar, 'Volver']) {
      expect(enLaHoja(nombre)).toBeOnTheScreen();
    }
    expect(campo()).toBeOnTheScreen();
    await escribir('');
    await tocarGuardar();
    await alertaEncima(TEXTO.campoVacio);

    await fireEvent.press(enLaHoja(TEXTO.borrar));
    await screen.findByText(TEXTO.dialogo);

    expect(enLaHoja('Cancelar')).toBeOnTheScreen();
    expect(enLaHoja('Eliminar')).toBeOnTheScreen();
  });

  const TECNICO =
    /ahorroReal|acumulado|periodo|meta-(junio|agosto|septiembre)|\b(404|409)\b|NaN|\bnull\b|undefined|Internal|Meta de ahorro no encontrada/i;
  const sinTecnicismos = () => expect(textosEnOrden().join(' | ')).not.toMatch(TECNICO);

  it('CA-RF23-F31 la sección cargando, con datos, la hoja, el diálogo y sus avisos usan palabras cotidianas', async () => {
    const carga = pendiente<AhorroAcumulado>();
    acumulado.mockReturnValueOnce(carga.promesa);
    await render(<MetaDeAhorro />);
    await screen.findByRole('button', { name: 'Guardar meta' });
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    sinTecnicismos();

    await act(async () => carga.resolver(acumuladoDelServidor('2026-09')));
    await screen.findByText(TEXTO.total);
    sinTecnicismos();

    await abrirHoja(CAMBIAR_JUNIO);
    sinTecnicismos();
    await escribir('300000');
    guardar.mockRejectedValueOnce(new ApiError(500, 'Internal server error: ahorroReal'));
    await tocarGuardar();
    await alertaEncima(TEXTO.errorGuardar);
    sinTecnicismos();

    await fireEvent.press(enLaHoja(TEXTO.borrar));
    await screen.findByText(TEXTO.dialogo);
    guardar.mockRejectedValueOnce(new ApiError(500, 'Internal server error: ahorroReal'));
    await fireEvent.press(enLaHoja('Eliminar'));
    await alertaEncima(TEXTO.errorBorrar);
    sinTecnicismos();
  });

  it.each(['vacía', 'con error', 'con el mes sin meta'])(
    'CA-RF23-F31 la sección %s usa palabras cotidianas',
    async (estado) => {
      if (estado === 'vacía') sembrar();
      if (estado === 'con error')
        acumulado.mockRejectedValue(new ApiError(500, 'Internal server error: periodo'));
      await mostrar();

      if (estado === 'vacía') await screen.findByText(TEXTO.vacio);
      else if (estado === 'con error') await screen.findByText(TEXTO.errorCarga);
      else {
        await abrirHoja();
        await escribir('320000');
        guardar.mockRejectedValueOnce(new ApiError(404, 'Meta de ahorro no encontrada'));
        await tocarGuardar();
        await alertaEncima(TEXTO.sinMeta);
      }

      sinTecnicismos();
    },
  );
});

// criterios/08-codigos-de-error.md
describe('Ahorro anotado: códigos de error', () => {
  async function fallarAlAnotar(fallo: Error) {
    await mostrarHoja();
    await escribir('320000');
    guardar.mockRejectedValueOnce(fallo);
    await tocarGuardar();
  }
  async function fallarAlBorrar(fallo: Error) {
    await mostrarDialogo();
    guardar.mockRejectedValueOnce(fallo);
    await fireEvent.press(enLaHoja('Eliminar'));
  }

  it('CA-RNF04-11 con META_NO_ENCONTRADA al anotar dice que el mes ya no tiene meta', async () => {
    await fallarAlAnotar(conCodigo(404, 'META_NO_ENCONTRADA'));

    await alertaEncima(TEXTO.sinMeta);
  });

  it('CA-RNF04-15 una dirección que no existe al anotar muestra el texto general', async () => {
    await fallarAlAnotar(rutaNoEncontrada());

    await alertaEncima(TEXTO.errorGuardar);
    expect(hayTexto(TEXTO.sinMeta)).toBe(false);
  });

  it('CA-RNF04-15 una dirección que no existe al borrar no lo da por borrado', async () => {
    await fallarAlBorrar(rutaNoEncontrada());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorBorrar);
    expect(dialogoAbierto()).toBe(true);
  });

  it.each(CON_TEXTO_GENERAL)(
    '%s con %s al anotar muestra el texto general, sin lo que manda el servidor',
    async (_id, _code, fallo) => {
      await fallarAlAnotar(fallo);

      await alertaEncima(TEXTO.errorGuardar);
    },
  );

  it('CA-RNF04-17 con ERROR_HTTP al borrar lo anotado muestra el texto general', async () => {
    await fallarAlBorrar(errorHttp());

    await alertaEncima(TEXTO.errorBorrar);
  });

  it.each([
    ['anotar', fallarAlAnotar],
    ['borrar lo anotado', fallarAlBorrar],
  ])(
    'CA-RNF04-18 con un caso sin texto propio al %s muestra el message y el action',
    async (_accion, fallar) => {
      await fallar(desconocido());

      await waitFor(() => expect(laHoja().getByRole('alert')).toHaveTextContent(MENSAJE_Y_ACCION));
    },
  );
});
