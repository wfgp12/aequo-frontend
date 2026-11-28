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

  // Cambió con el paquete 8.3.9 (CA-RNF04-02, decisión D3): antes llegaba como ApiError con "Bad Gateway"
  it('CA-RF06-24 un error cuyo cuerpo no es JSON llega como falla de conexión (NetworkError)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    const error = await request('/transacciones').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
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

// criterios/08-codigos-de-error.md
describe('cliente HTTP: códigos de error', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  const responder = (status: number, json: () => Promise<unknown>) =>
    fetchMock.mockResolvedValue({ ok: status < 300, status, statusText: 'Texto de estado', json });
  const fallo = () => request('/tarjetas').catch((e: unknown) => e);
  const noEsJson = async () => {
    throw new SyntaxError('Unexpected token < in JSON');
  };

  it('CA-RNF04-01 el ApiError trae el estado, el message, el code y el action', async () => {
    responder(409, async () => ({
      statusCode: 409,
      error: 'Conflict',
      message: 'Ya existe una tarjeta con ese nombre',
      code: 'TARJETA_DUPLICADA',
      action: 'Usa otro nombre',
    }));

    const error = await fallo();

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: 'Ya existe una tarjeta con ese nombre',
      code: 'TARJETA_DUPLICADA',
      action: 'Usa otro nombre',
    });
  });

  it('CA-RNF04-01 en las validaciones los mensajes llegan unidos, junto con el code', async () => {
    responder(400, async () => ({
      statusCode: 400,
      error: 'Bad Request',
      message: ['valor debe ser mayor que 0', 'cuotas debe ser un entero'],
      code: 'VALIDACION',
    }));

    expect(await fallo()).toMatchObject({
      status: 400,
      message: 'valor debe ser mayor que 0, cuotas debe ser un entero',
      code: 'VALIDACION',
    });
  });

  it('CA-RNF04-01 sin code ni action (backend de hoy) llegan vacíos y lo demás queda igual', async () => {
    responder(404, async () => ({ statusCode: 404, message: 'Tarjeta no encontrada' }));

    const error = (await fallo()) as ApiError & { code?: string; action?: string };

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Tarjeta no encontrada' });
    expect(error.code).toBeFalsy();
    expect(error.action).toBeFalsy();
  });

  it.each([502, 503])(
    'CA-RNF04-02 un %s con una página que no es JSON es una falla de conexión',
    async (status) => {
      responder(status, noEsJson);

      expect(await fallo()).toBeInstanceOf(NetworkError);
    },
  );

  it('CA-RNF04-02 un 204 sin cuerpo sigue siendo un éxito', async () => {
    responder(204, noEsJson);

    await expect(request('/tarjetas/t1', { method: 'DELETE' })).resolves.toBeNull();
  });
});
