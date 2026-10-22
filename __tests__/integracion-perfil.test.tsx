import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Perfil y cierre de sesión (paquete 1.3.3) con el router, la sesión y el Adapter reales.
// Se simulan solo los bordes del sistema: Firebase/Google, el backend (fetch) y el almacenamiento.
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

const usuarioDeLaSesion = {
  id: 'u1',
  nombre: 'Nombre de la sesión',
  email: 'a@c.com',
  fotoUrl: null,
};
const usuarioDelBackend = {
  id: 'u1',
  nombre: 'Ana Prueba',
  email: 'ana@correo.com',
  fotoUrl: null,
};
const rutas = { _layout: Layout, index: Home, login: Login, perfil: Perfil };
const fetchMock = jest.fn();

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

async function abrirPerfil() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({
      accessToken: 'jwt-guardado',
      usuario: usuarioDeLaSesion,
      expiraEn: Date.now() + 60_000,
    }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
  await fireEvent.press(await screen.findByText('Mi perfil'));
}

describe('Perfil y cierre de sesión (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('desde la vista principal abre el perfil con los datos que entrega el backend', async () => {
    fetchMock.mockResolvedValue(respuesta(200, usuarioDelBackend));
    await abrirPerfil();

    expect(await screen.findByText('Ana Prueba')).toBeOnTheScreen();
    expect(screen.getByText('ana@correo.com')).toBeOnTheScreen();
    expect(screen.queryByText('Nombre de la sesión')).toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/usuarios\/me$/);
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
  });

  it('cerrar sesión desde el perfil vuelve al login y borra la sesión guardada', async () => {
    fetchMock.mockResolvedValue(respuesta(200, usuarioDelBackend));
    await abrirPerfil();

    await fireEvent.press(await screen.findByText('Cerrar sesión'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('si el backend responde 401 (por ejemplo, cuenta eliminada) cierra la sesión y vuelve al login', async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );
    await abrirPerfil();

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('si el backend falla (500) avisa y permite reintentar sin cerrar la sesión', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(500, { message: 'error' }));
    fetchMock.mockResolvedValueOnce(respuesta(200, usuarioDelBackend));
    await abrirPerfil();

    expect(await screen.findByText(/No pudimos cargar tu perfil/)).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(true);

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('Ana Prueba')).toBeOnTheScreen();
  });
});
