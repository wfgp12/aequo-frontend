import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError } from '@/lib/api/client';
import { eliminarCuenta } from '@/lib/api/usuarios';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('Adapter: eliminar la cuenta', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    alRechazarSesion.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    registrarManejadorDeSesion({
      obtenerSesion: () => ({ accessToken: 'jwt-vigente', expiraEn: Date.now() + 60_000 }),
      alRechazarSesion,
    });
  });
  afterAll(() => registrarManejadorDeSesion(null));

  it('llama a DELETE /usuarios/me con el token, sin body, y acepta el 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });

    await expect(eliminarCuenta()).resolves.toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/usuarios\/me$/);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('ante un 401 cierra la sesión y no hay nada que reintentar', async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );

    await expect(eliminarCuenta()).rejects.toBeInstanceOf(ApiError);
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('ante un 500 (reintentable) no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'error' }));

    await expect(eliminarCuenta()).rejects.toMatchObject({ status: 500 });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
