import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Eliminación de cuenta (paquete 1.3.4) con el router, la sesión y el Adapter reales.
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

const usuario = { id: 'u1', nombre: 'Ana Prueba', email: 'ana@correo.com', fotoUrl: null };
const rutas = { _layout: Layout, index: Home, login: Login, perfil: Perfil };
const fetchMock = jest.fn();
const CAMPO = 'Escribe ELIMINAR para confirmar';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

const sinCuerpo = {
  ok: true,
  status: 204,
  statusText: 'No Content',
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
};

/** Responde según el método: el perfil por GET y lo demás según cada prueba. */
function backend(alEliminar: () => unknown) {
  fetchMock.mockImplementation(async (_url: string, init: { method: string }) =>
    init.method === 'DELETE' ? alEliminar() : respuesta(200, usuario),
  );
}

async function abrirDialogoDeEliminacion() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
  await fireEvent.press(await screen.findByText('Mi perfil'));
  await fireEvent.press(await screen.findByText('Eliminar mi cuenta'));
}

async function escribirYConfirmar() {
  await fireEvent.changeText(screen.getByLabelText(CAMPO), 'ELIMINAR');
  await fireEvent.press(screen.getByText('Eliminar cuenta'));
}

function llamadasDelete() {
  return fetchMock.mock.calls.filter(([, init]) => init.method === 'DELETE');
}

describe('Eliminar la cuenta (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('éxito: llama a DELETE /usuarios/me con el token, borra la sesión local y vuelve al login', async () => {
    backend(() => sinCuerpo);
    await abrirDialogoDeEliminacion();

    await escribirYConfirmar();

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText('¿Eliminar tu cuenta?')).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);

    const [url, init] = llamadasDelete()[0];
    expect(url).toMatch(/\/usuarios\/me$/);
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
    expect(init.body).toBeUndefined();
  });

  it('sin escribir la palabra exacta no se llama al backend', async () => {
    backend(() => sinCuerpo);
    await abrirDialogoDeEliminacion();

    await fireEvent.changeText(screen.getByLabelText(CAMPO), 'eliminar');
    await fireEvent.press(screen.getByText('Eliminar cuenta'));

    expect(llamadasDelete()).toHaveLength(0);
    expect(mockAlmacen.has('sesion')).toBe(true);
  });

  it('cancelar no elimina nada y la sesión sigue abierta', async () => {
    backend(() => sinCuerpo);
    await abrirDialogoDeEliminacion();

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(screen.queryByText('¿Eliminar tu cuenta?')).toBeNull();
    expect(screen.getByText('Ana Prueba')).toBeOnTheScreen();
    expect(llamadasDelete()).toHaveLength(0);
    expect(mockAlmacen.has('sesion')).toBe(true);
  });

  it('fallo del backend (500): avisa, mantiene la sesión y permite reintentar', async () => {
    let intentos = 0;
    backend(() => (++intentos === 1 ? respuesta(500, { message: 'error' }) : sinCuerpo));
    await abrirDialogoDeEliminacion();

    await escribirYConfirmar();

    expect(await screen.findByText(/No pudimos eliminar tu cuenta\./)).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(true);

    await fireEvent.press(screen.getByText('Eliminar cuenta'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(llamadasDelete()).toHaveLength(2);
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('si el backend responde 401 vuelve al login sin mostrar el aviso de error', async () => {
    backend(() =>
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );
    await abrirDialogoDeEliminacion();

    await escribirYConfirmar();

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(screen.queryByText(/No pudimos eliminar tu cuenta\./)).toBeNull();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
