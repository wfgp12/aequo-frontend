import Avance from '@/app/avance-en-efectivo';
import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Tarjetas from '@/app/tarjetas';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { esperar, plano, usarReloj, vaciar } from './ayudas/compra-tarjeta';
import { UUID } from './ayudas/tarjetas';

// Avance en efectivo de punta a punta (criterios/05-compra-con-tarjeta.md, CA-RF28-F01, F03, F08, F10, F12 y F14) con
// el router, la sesión y los Adapters reales: se entra desde "Mis tarjetas" y se vuelve a ella. Se simulan solo los
// bordes del sistema: Firebase/Google, el backend (fetch) y el almacenamiento. Hoy es el 19 de noviembre de 2026
// (reloj simulado: la espera de 400 ms de la cuota se adelanta a mano).
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
const rutas = {
  _layout: Layout,
  index: Home,
  login: Login,
  tarjetas: Tarjetas,
  'avance-en-efectivo': Avance,
};
const fetchMock = jest.fn();

const VISA_ID = '66a0b3c4d5e6f70012ab34cd';
const visa = {
  id: VISA_ID,
  nombre: 'Visa Bancolombia',
  tasaEA: 0.2921,
  cuotaUnicaSinInteres: false,
  creadaEn: '2026-09-17T15:00:00.000Z',
  actualizadaEn: '2026-09-17T15:00:00.000Z',
};
const avance = {
  id: '66b1b3c4d5e6f70012ab34cd',
  tarjetaId: VISA_ID,
  categoriaId: null,
  tipo: 'AVANCE',
  descripcion: 'Avance en efectivo',
  valor: 500000,
  cuotas: 6,
  fecha: '2026-11-19',
  primerPago: '2026-12',
  mesUltimoPago: '2027-05',
  tasaEAAplicada: 0.2921,
  cuotaUnicaSinInteres: false,
  cuota: 89741.0851,
  creadaEn: '2026-11-19T17:00:00.000Z',
  actualizadaEn: '2026-11-19T17:00:00.000Z',
};

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}
const sesionVencida = () =>
  respuesta(401, { statusCode: 401, message: 'Sesión inválida o vencida', error: 'Unauthorized' });

type Init = { method: string; body?: string; headers: Record<string, string> };

/** Backend simulado: tarjetas, vista previa de la cuota y guardado del avance. */
function backend({ avanzar }: { avanzar?: () => unknown } = {}) {
  fetchMock.mockImplementation(async (url: string, init: Init) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith('/tarjetas') && init.method === 'GET') {
      return respuesta(200, { items: [visa] });
    }
    if (pathname.endsWith('/cuota')) {
      return respuesta(200, {
        cuota: Number(searchParams.get('cuotas')) === 6 ? 89741.0851 : 500000,
        mesUltimoPago: '2027-05',
        tasaEAAplicada: 0.2921,
        cuotaUnicaSinInteres: false,
      });
    }
    if (pathname.endsWith('/avances') && init.method === 'POST') {
      return avanzar ? avanzar() : respuesta(201, avance);
    }
    return respuesta(404, { message: 'no simulado' });
  });
}

const llamadasA = (termina: string, metodo: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => new URL(url).pathname.endsWith(termina) && init.method === metodo,
  );

async function abrirMisTarjetas() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/tarjetas' });
  await screen.findByText('Mis tarjetas');
}

async function abrirElAvance() {
  await abrirMisTarjetas();
  await fireEvent.press(await screen.findByRole('button', { name: 'Avance en efectivo' }));
  await screen.findByText('¿Cuánto dinero necesitas?');
}

async function hastaElResumen() {
  await abrirElAvance();
  await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Visa Bancolombia, Tasa 29,21 % E.A.' }),
  );
  await screen.findByText('¿Cuántas cuotas?');
  await fireEvent.press(screen.getByRole('button', { name: '6 cuotas' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
  await esperar(400);
  await vaciar();
  expect(plano()).toContain('$ 89.741 x 6');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('¿Cuándo fue?');
  await fireEvent.press(screen.getByText('Siguiente'));
  await screen.findByText('Resumen');
}

describe('Avance en efectivo (integración)', () => {
  beforeEach(() => {
    usarReloj();
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('CA-RF28-F01 el botón "Avance en efectivo" de "Mis tarjetas" lleva a la pantalla del avance', async () => {
    backend();

    await abrirElAvance();

    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos')).toBeOnTheScreen();
  });

  it('CA-RF28-F03 "Cerrar" vuelve a "Mis tarjetas" sin enviar nada', async () => {
    backend();
    await abrirElAvance();
    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '500000');

    await fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(await screen.findByText('Mis tarjetas')).toBeOnTheScreen();
    expect(llamadasA('/avances', 'POST')).toHaveLength(0);
  });

  it('CA-RF28-F08, F10 y F14 el avance guarda POST /tarjetas/:id/avances con el contrato del backend, confirma y "Listo" vuelve a "Mis tarjetas"', async () => {
    backend();
    await hastaElResumen();

    expect(plano()).toContain('Último pago mayo 2027');
    expect(plano()).toContain(
      'Este dinero entra como dinero recibido: no cuenta como ingreso propio.',
    );
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(plano()).toContain(
      'Registramos tu avance de $ 500.000 con Visa Bancolombia, a 6 cuotas de $ 89.741. Este dinero entra como dinero recibido: no cuenta como ingreso propio.',
    );
    expect(llamadasA('/avances', 'POST')).toHaveLength(1);
    const [url, init] = llamadasA('/avances', 'POST')[0];
    expect(new URL(url).pathname).toBe(`/tarjetas/${VISA_ID}/avances`);
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toMatch(UUID);
    expect(JSON.parse(init.body as string)).toEqual({
      valor: 500000,
      cuotas: 6,
      primerPago: '2026-12',
      fecha: '2026-11-19',
    });
    expect(llamadasA('/compras', 'POST')).toHaveLength(0);
    expect(llamadasA('/transacciones', 'POST')).toHaveLength(0);

    await fireEvent.press(screen.getByText('Listo'));

    expect(await screen.findByText('Mis tarjetas')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Avance en efectivo' })).toBeOnTheScreen();
  });

  it('CA-RF28-F12 si el backend responde 401 al guardar vuelve al inicio de sesión', async () => {
    backend({ avanzar: sesionVencida });
    await hastaElResumen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
