import { login } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/client';

const usuario = { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', fotoUrl: null };

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('Adapter de autenticación', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('envía el ID Token por POST /auth/login y devuelve la sesión', async () => {
    const cuerpo = { accessToken: 'jwt', expiresIn: 86400, usuario };
    fetchMock.mockResolvedValue(respuesta(200, cuerpo));

    await expect(login('id-token')).resolves.toEqual(cuerpo);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ idToken: 'id-token' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('lanza ApiError 401 cuando el token es inválido', async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'ID Token inválido o vencido',
        error: 'Unauthorized',
      }),
    );
    const error = await login('malo').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'ID Token inválido o vencido' });
  });

  it('une los mensajes cuando el 400 trae un arreglo', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { message: ['idToken no puede estar vacío', 'idToken debe ser texto'] }),
    );
    await expect(login('')).rejects.toMatchObject({
      status: 400,
      message: 'idToken no puede estar vacío, idToken debe ser texto',
    });
  });

  it('lanza NetworkError si el servidor no responde', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(login('x')).rejects.toBeInstanceOf(NetworkError);
  });
});
