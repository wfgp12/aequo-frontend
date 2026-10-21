import { registrarManejadorDeSesion, requestAutenticado } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

const SESION_VIGENTE = { accessToken: 'jwt-vigente', expiraEn: Date.now() + 60_000 };
const ERROR_401 = { statusCode: 401, message: 'Sesión inválida o vencida', error: 'Unauthorized' };

describe('Cliente autenticado (guard de sesión del frontend)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  let sesion: { accessToken: string; expiraEn: number } | null;

  beforeEach(() => {
    fetchMock.mockReset();
    alRechazarSesion.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    sesion = SESION_VIGENTE;
    registrarManejadorDeSesion({ obtenerSesion: () => sesion, alRechazarSesion });
  });
  afterAll(() => registrarManejadorDeSesion(null));

  it('adjunta Authorization: Bearer con el JWT de la sesión y devuelve la respuesta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { id: 'u1' }));

    await expect(requestAutenticado('/usuarios/me')).resolves.toEqual({ id: 'u1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/usuarios\/me$/);
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('respeta el método y el body de la llamada', async () => {
    fetchMock.mockResolvedValue(respuesta(200, {}));
    await requestAutenticado('/transacciones', { method: 'POST', body: { valor: 1000 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ valor: 1000 });
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('ante un 401 cierra la sesión local y relanza el error', async () => {
    fetchMock.mockResolvedValue(respuesta(401, ERROR_401));

    const error = await requestAutenticado('/usuarios/me').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Sesión inválida o vencida' });
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no llama al backend y la rechaza como 401', async () => {
    sesion = null;

    await expect(requestAutenticado('/usuarios/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('con la sesión vencida localmente no llama al backend y la rechaza como 401', async () => {
    sesion = { accessToken: 'jwt-viejo', expiraEn: Date.now() - 1 };

    await expect(requestAutenticado('/usuarios/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it.each([400, 404, 500])('un %i no cierra la sesión', async (status) => {
    fetchMock.mockResolvedValue(respuesta(status, { message: 'error' }));

    await expect(requestAutenticado('/usuarios/me')).rejects.toMatchObject({ status });

    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('una falla de red no cierra la sesión', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(requestAutenticado('/usuarios/me')).rejects.toBeInstanceOf(NetworkError);

    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('sin manejador registrado también rechaza sin llamar al backend', async () => {
    registrarManejadorDeSesion(null);

    await expect(requestAutenticado('/usuarios/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
