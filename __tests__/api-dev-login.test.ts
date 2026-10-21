import { loginDeDesarrollo } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const usuario = {
  id: 'u1',
  nombre: 'Usuario de prueba',
  email: 'prueba@aequo.local',
  fotoUrl: null,
};

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('Adapter de la sesión de prueba', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('llama a POST /auth/dev-login sin body ni Authorization', async () => {
    const cuerpo = { accessToken: 'jwt', expiresIn: 86400, usuario };
    fetchMock.mockResolvedValue(respuesta(200, cuerpo));

    await expect(loginDeDesarrollo()).resolves.toEqual(cuerpo);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/dev-login$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('lanza ApiError 404 cuando el backend no tiene activada la sesión de prueba', async () => {
    fetchMock.mockResolvedValue(
      respuesta(404, { statusCode: 404, message: 'Cannot POST /auth/dev-login' }),
    );
    const error = await loginDeDesarrollo().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
  });
});
