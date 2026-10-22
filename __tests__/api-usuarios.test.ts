import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError } from '@/lib/api/client';
import { obtenerPerfil } from '@/lib/api/usuarios';

const usuario = { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', fotoUrl: null };

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('Adapter de usuarios', () => {
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

  it('consulta GET /usuarios/me con el token de la sesión y devuelve el usuario', async () => {
    fetchMock.mockResolvedValue(respuesta(200, usuario));

    await expect(obtenerPerfil()).resolves.toEqual(usuario);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/usuarios\/me$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('ante un 401 (por ejemplo, la cuenta ya no existe) cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );

    await expect(obtenerPerfil()).rejects.toBeInstanceOf(ApiError);
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('ante un 500 no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'error' }));

    await expect(obtenerPerfil()).rejects.toMatchObject({ status: 500 });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
