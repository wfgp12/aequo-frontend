import { ApiError, NetworkError, request } from '@/lib/api/client';

// Refuerzo (criterios/02-registro-idempotencia.md, "Cliente HTTP compartido"): comportamiento común a todas las llamadas.
describe('cliente HTTP (request)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('CA-RF06-23 envía el cuerpo como JSON con el header Content-Type, con sesión', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 't1' }) });

    await request('/transacciones', { method: 'POST', body: { monto: 45000 }, token: 'jwt' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(init.body).toBe('{"monto":45000}');
  });

  it('CA-RF06-23 también envía JSON cuando todavía no hay sesión, sin Authorization', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await request('/auth/google', { method: 'POST', body: { idToken: 'x' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('CA-RF06-24 un error cuyo cuerpo no es JSON llega como ApiError con el texto de estado', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    const error = await request('/transacciones').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('CA-RF06-24 un error con JSON sin "message" llega como ApiError con el texto de estado', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ statusCode: 500 }),
    });

    const error = await request('/transacciones').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, message: 'Internal Server Error' });
  });

  it('CA-RF06-25 sin conexión lanza un NetworkError con un mensaje sencillo', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await request('/transacciones').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toBe('No se pudo conectar con el servidor');
  });
});
