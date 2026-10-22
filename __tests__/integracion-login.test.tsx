import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import { signInWithGoogle } from '@/lib/google-sign-in';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

// Flujo completo de inicio de sesión (paquete 1.1.5). Se simulan solo los bordes del sistema:
// Firebase/Google (la verificación del token), el backend (fetch) y el almacenamiento.
// El router, la sesión, el Adapter y las pantallas son los reales.
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
const rutas = { _layout: Layout, index: Home, login: Login, perfil: Perfil };
const fetchMock = jest.fn();

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

function sesionGuardada(expiraEn: number) {
  mockAlmacen.set('sesion', JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn }));
}

describe('Flujo de inicio de sesión (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  it('éxito: sin sesión muestra el login, entra con Google y llega a la vista principal', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue('id-token-firebase');
    fetchMock.mockResolvedValue(
      respuesta(200, { accessToken: 'jwt-propio', expiresIn: 86400, usuario }),
    );
    await renderRouter(rutas, { initialUrl: '/' });

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();

    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(await screen.findByText('Hola, Ana Prueba')).toBeOnTheScreen();
    expect(screen.queryByText('Continuar con Google')).toBeNull();

    // El backend recibió el ID Token de Firebase una sola vez, y la app guardó su propio JWT
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ idToken: 'id-token-firebase' });
    expect(JSON.parse(mockAlmacen.get('sesion') as string).accessToken).toBe('jwt-propio');
  });

  it('fallo: si el backend rechaza el token (401) se queda en el login con un aviso y sin sesión', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue('token-invalido');
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'ID Token inválido o vencido',
        error: 'Unauthorized',
      }),
    );
    await renderRouter(rutas, { initialUrl: '/' });

    await fireEvent.press(await screen.findByText('Continuar con Google'));

    expect(
      await screen.findByText('No pudimos verificar tu cuenta. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('fallo: si no hay conexión con el servidor avisa y no abre sesión', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue('id-token-firebase');
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await renderRouter(rutas, { initialUrl: '/' });

    await fireEvent.press(await screen.findByText('Continuar con Google'));

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('cancelación: si el usuario cierra la ventana de Google no se llama al backend', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue(null);
    await renderRouter(rutas, { initialUrl: '/' });

    await fireEvent.press(await screen.findByText('Continuar con Google'));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Continuar con Google')).toBeOnTheScreen();
  });

  it('con una sesión guardada y vigente abre directo la vista principal', async () => {
    sesionGuardada(Date.now() + 60_000);
    await renderRouter(rutas, { initialUrl: '/' });

    expect(await screen.findByText('Hola, Ana Prueba')).toBeOnTheScreen();
    expect(screen.queryByText('Continuar con Google')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con una sesión guardada pero vencida vuelve al login y la descarta', async () => {
    sesionGuardada(Date.now() - 1_000);
    await renderRouter(rutas, { initialUrl: '/' });

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('cerrar sesión vuelve al login y borra la sesión guardada', async () => {
    sesionGuardada(Date.now() + 60_000);
    fetchMock.mockResolvedValue(respuesta(200, usuario));
    await renderRouter(rutas, { initialUrl: '/' });

    await fireEvent.press(await screen.findByText('Mi perfil'));
    await fireEvent.press(await screen.findByText('Cerrar sesión'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('Hola, Ana Prueba')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
