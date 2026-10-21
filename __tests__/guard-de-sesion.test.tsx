import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import { requestAutenticado } from '@/lib/api/autenticado';
import { act, renderRouter, screen } from 'expo-router/testing-library';

// Guard de sesión del frontend (paquete 1.2): con la sesión y el router reales, una ruta protegida
// que responde 401 o una sesión que vence deben devolver al usuario al login.
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
const rutas = { _layout: Layout, index: Home, login: Login };
const fetchMock = jest.fn();

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

function sesionGuardada(expiraEn: number) {
  mockAlmacen.set('sesion', JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn }));
}

describe('Guard de sesión (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('una llamada autenticada envía el JWT guardado de la sesión', async () => {
    sesionGuardada(Date.now() + 60_000);
    fetchMock.mockResolvedValue(respuesta(200, { id: 'u1' }));
    await renderRouter(rutas, { initialUrl: '/' });
    await screen.findByText('Hola, Ana Prueba');

    await act(async () => {
      await requestAutenticado('/usuarios/me');
    });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-guardado');
    expect(screen.getByText('Hola, Ana Prueba')).toBeOnTheScreen();
  });

  it('si el backend responde 401 a una ruta protegida, cierra la sesión y vuelve al login', async () => {
    sesionGuardada(Date.now() + 60_000);
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );
    await renderRouter(rutas, { initialUrl: '/' });
    await screen.findByText('Hola, Ana Prueba');

    await act(async () => {
      await requestAutenticado('/usuarios/me').catch(() => undefined);
    });

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('cuando la sesión vence con la app abierta, cierra la sesión sola y vuelve al login', async () => {
    // Vencimiento real y corto (sin temporizadores falsos, que se estorban con las esperas de Testing Library)
    sesionGuardada(Date.now() + 2_500);
    await renderRouter(rutas, { initialUrl: '/' });
    await screen.findByText('Hola, Ana Prueba');

    expect(
      await screen.findByText('Continuar con Google', {}, { timeout: 4_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
