import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import Registrar from '@/app/registrar';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { esperar, plano, usarReloj, vaciar } from './ayudas/compra-tarjeta';
import { UUID } from './ayudas/tarjetas';

// Compra con tarjeta de punta a punta (criterios/05-compra-con-tarjeta.md, CA-RF26-F16, F18, F25 y F27, CA-RF27-F01 y
// F15, y el 401 de CA-RF26-F05) con el router, la sesión y los Adapters reales. Se simulan solo los bordes del
// sistema: Firebase/Google, el backend (fetch) y el almacenamiento. Hoy es el 19 de noviembre de 2026 (reloj simulado: la espera de 400 ms
// de la cuota se adelanta a mano).
const mockAlmacen = new Map<string, string>();

jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/firebase', () => ({
  auth: { signOut: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/google-sign-in', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/lib/session-storage', () => ({
  sessionStorage: {
    get: async () => mockAlmacen.get('sesion') ?? null,
    set: async (v: string) => void mockAlmacen.set('sesion', v),
    remove: async () => void mockAlmacen.delete('sesion'),
  },
}));

const usuario = { id: 'u1', nombre: 'Ana Prueba', email: 'ana@correo.com', fotoUrl: null };
const rutas = { _layout: Layout, index: Home, login: Login, perfil: Perfil, registrar: Registrar };
const fetchMock = jest.fn();

const VISA_ID = '66a0b3c4d5e6f70012ab34cd';
const alimentacion = {
  id: 'cat-1',
  nombre: 'Alimentación',
  tipo: 'EGRESO',
  esPredeterminada: true,
  movimientos: 0,
};
const visa = {
  id: VISA_ID,
  nombre: 'Visa Bancolombia',
  tasaEA: 0.2921,
  cuotaUnicaSinInteres: false,
  creadaEn: '2026-09-17T15:00:00.000Z',
  actualizadaEn: '2026-09-17T15:00:00.000Z',
};
const compra = {
  id: '66b0b3c4d5e6f70012ab34cd',
  tarjetaId: VISA_ID,
  categoriaId: 'cat-1',
  tipo: 'COMPRA',
  descripcion: 'Alimentación',
  valor: 1254700,
  cuotas: 12,
  fecha: '2026-11-19',
  primerPago: '2026-12',
  mesUltimoPago: '2027-11',
  tasaEAAplicada: 0.2921,
  cuotaUnicaSinInteres: false,
  cuota: 119802.1331718775,
  creadaEn: '2026-11-19T17:00:00.000Z',
  actualizadaEn: '2026-11-19T17:00:00.000Z',
};

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}
const sesionVencida = () =>
  respuesta(401, { statusCode: 401, message: 'Sesión inválida o vencida', error: 'Unauthorized' });

type Init = { method: string; body?: string; headers: Record<string, string> };
type Backend = {
  tarjetas?: () => unknown;
  cuota?: (consulta: URLSearchParams) => unknown;
  comprar?: () => unknown;
};

const cuotaPorDefecto = (consulta: URLSearchParams) =>
  respuesta(200, {
    cuota: consulta.get('cuotas') === '1' ? Number(consulta.get('valor')) : 119802.1331718775,
    mesUltimoPago: '2027-11',
    tasaEAAplicada: 0.2921,
    cuotaUnicaSinInteres: false,
  });

/** Backend simulado: categorías, tarjetas, vista previa de la cuota y guardado de la compra. */
function backend({ tarjetas, cuota, comprar }: Backend = {}) {
  fetchMock.mockImplementation(async (url: string, init: Init) => {
    const { pathname, searchParams } = new URL(url);
    if (url.includes('/categorias?tipo=EGRESO')) return respuesta(200, { items: [alimentacion] });
    if (pathname.endsWith('/tarjetas') && init.method === 'GET') {
      return tarjetas ? tarjetas() : respuesta(200, { items: [visa] });
    }
    if (pathname.endsWith('/cuota')) return (cuota ?? cuotaPorDefecto)(searchParams);
    if (pathname.endsWith('/compras') && init.method === 'POST') {
      return comprar ? comprar() : respuesta(201, compra);
    }
    return respuesta(404, { message: 'no simulado' });
  });
}

const llamadasA = (termina: string, metodo: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => new URL(url).pathname.endsWith(termina) && init.method === metodo,
  );

async function abrirHome() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
}

async function hastaLaListaDeTarjetas() {
  await abrirHome();
  await fireEvent.press(await screen.findByText('Registrar egreso'));
  await fireEvent.changeText(await screen.findByLabelText('Monto en pesos'), '1254700');
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(await screen.findByLabelText('Alimentación'));
  await fireEvent.press(await screen.findByLabelText('Tarjeta crédito'));
}

async function hastaLasCuotas() {
  await hastaLaListaDeTarjetas();
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Visa Bancolombia, Tasa 29,21 % E.A.' }),
  );
  await screen.findByText('¿Cuántas cuotas?');
}

/** Deja pasar los 400 ms de la espera y que llegue la respuesta de la cuota. */
async function esperarLaEstimacion() {
  await esperar(400);
  await vaciar();
}

/** Pasa de las cuotas (con 12 cuotas desde diciembre) al resumen. */
async function hastaElResumen() {
  await hastaLasCuotas();
  await fireEvent.press(screen.getByRole('button', { name: '12 cuotas' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
  await esperarLaEstimacion();
  expect(plano()).toContain('$ 119.802 x 12');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('¿Cuándo fue?');
  await fireEvent.press(screen.getByText('Siguiente'));
  await screen.findByText('Resumen');
}

describe('Compra con tarjeta (integración)', () => {
  beforeEach(() => {
    usarReloj();
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('CA-RF26-F16 y F27 el egreso con tarjeta recorre los pasos y guarda POST /tarjetas/:id/compras con el contrato del backend, sin crear un movimiento', async () => {
    backend();
    await hastaElResumen();

    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(plano()).toContain('Último pago noviembre 2027');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(plano()).toContain(
      'Registramos tu compra de $ 1.254.700 en Alimentación con Visa Bancolombia, a 12 cuotas de $ 119.802.',
    );

    expect(llamadasA('/compras', 'POST')).toHaveLength(1);
    const [url, init] = llamadasA('/compras', 'POST')[0];
    expect(new URL(url).pathname).toBe(`/tarjetas/${VISA_ID}/compras`);
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toMatch(UUID);
    expect(JSON.parse(init.body as string)).toEqual({
      descripcion: 'Alimentación',
      categoriaId: 'cat-1',
      valor: 1254700,
      cuotas: 12,
      primerPago: '2026-12',
      fecha: '2026-11-19',
    });
    expect(llamadasA('/transacciones', 'POST')).toHaveLength(0);

    await fireEvent.press(screen.getByText('Listo'));
    expect(await screen.findByText('Registrar egreso')).toBeOnTheScreen();
  });

  it('CA-RF27-F01 la vista previa pide GET /tarjetas/:id/cuota con el valor, las cuotas y el primer pago, con el JWT, sin cuerpo y sin clave', async () => {
    backend();
    await hastaLasCuotas();
    await fireEvent.press(screen.getByRole('button', { name: '12 cuotas' }));
    await esperarLaEstimacion();
    expect(plano()).toContain('$ 119.802 x 12');

    const consultas = llamadasA('/cuota', 'GET');
    expect(consultas.length).toBeGreaterThanOrEqual(2);
    const [primera, segunda] = [consultas[0], consultas[consultas.length - 1]];
    const una = new URL(primera[0]);
    expect(una.pathname).toBe(`/tarjetas/${VISA_ID}/cuota`);
    expect(Object.fromEntries(una.searchParams)).toEqual({
      valor: '1254700',
      cuotas: '1',
      primerPago: '2026-11',
    });
    expect(Object.fromEntries(new URL(segunda[0]).searchParams)).toEqual({
      valor: '1254700',
      cuotas: '12',
      primerPago: '2026-11',
    });
    expect(segunda[1].headers.Authorization).toBe('Bearer jwt-guardado');
    expect(segunda[1].headers).not.toHaveProperty('Idempotency-Key');
    expect(segunda[1].body).toBeUndefined();
  });

  it('CA-RF26-F05 si el backend responde 401 al pedir las tarjetas vuelve al inicio de sesión', async () => {
    backend({ tarjetas: sesionVencida });
    await hastaLaListaDeTarjetas();

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('CA-RF27-F15 si el backend responde 401 en la vista previa vuelve al inicio de sesión', async () => {
    backend({ cuota: sesionVencida });
    await hastaLaListaDeTarjetas();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Visa Bancolombia, Tasa 29,21 % E.A.' }),
    );

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('CA-RF26-F25 si el backend responde 401 al guardar vuelve al inicio de sesión', async () => {
    backend({ comprar: sesionVencida });
    await hastaElResumen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
