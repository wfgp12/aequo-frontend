import { ApiError, request } from '@/lib/api/client';

// criterios/03-zona-horaria.md (RF-13): el cliente HTTP le dice al backend en qué zona está la persona.
describe('cliente HTTP: header X-Zona-Horaria', () => {
  const fetchMock = jest.fn();
  let zonaDelDispositivo: string | undefined;

  const cabecerasDe = (llamada = 0) => fetchMock.mock.calls[llamada][1].headers as Record<string, string>;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    zonaDelDispositivo = 'America/Bogota';
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: zonaDelDispositivo }) }) as unknown as Intl.DateTimeFormat,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CA-RF13-01 una consulta con sesión lleva la zona del dispositivo tal cual', async () => {
    await request('/reportes/periodo', { token: 'jwt' });

    expect(cabecerasDe()['X-Zona-Horaria']).toBe('America/Bogota');
    expect(cabecerasDe().Authorization).toBe('Bearer jwt');
  });

  it('CA-RF13-01 el valor no se transforma (mayúsculas, espacios y guiones se envían como llegan)', async () => {
    zonaDelDispositivo = 'America/Argentina/Buenos_Aires';
    await request('/reportes/categorias', { token: 'jwt' });

    expect(cabecerasDe()['X-Zona-Horaria']).toBe('America/Argentina/Buenos_Aires');
  });

  it('CA-RF13-02 las peticiones sin sesión también llevan la zona y no llevan Authorization', async () => {
    await request('/auth/google', { method: 'POST', body: { idToken: 'x' } });

    expect(cabecerasDe()['X-Zona-Horaria']).toBe('America/Bogota');
    expect(cabecerasDe()).not.toHaveProperty('Authorization');
  });

  it.each(['POST', 'PATCH', 'DELETE'] as const)(
    'CA-RF13-03 una petición %s con sesión también lleva la zona',
    async (method) => {
      await request('/transacciones/t1', { method, body: method === 'DELETE' ? undefined : { monto: 1 }, token: 'jwt' });

      expect(cabecerasDe()['X-Zona-Horaria']).toBe('America/Bogota');
    },
  );

  it('CA-RF13-04 convive con Authorization, Content-Type e Idempotency-Key sin pisarlos', async () => {
    const clave = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    await request('/transacciones', { method: 'POST', body: { monto: 45000 }, token: 'jwt', claveIdempotencia: clave });

    expect(cabecerasDe()).toEqual({
      Authorization: 'Bearer jwt',
      'Content-Type': 'application/json',
      'Idempotency-Key': clave,
      'X-Zona-Horaria': 'America/Bogota',
    });
  });

  it.each([
    ['vacía', ''],
    ['indefinida', undefined],
  ])('CA-RF13-05 si la zona del dispositivo viene %s, el header se omite y la llamada funciona', async (_nombre, zona) => {
    zonaDelDispositivo = zona;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const respuesta = await request('/reportes/periodo', { token: 'jwt' });

    expect(respuesta).toEqual({ ok: true });
    expect(cabecerasDe()).not.toHaveProperty('X-Zona-Horaria');
    expect(Object.values(cabecerasDe())).not.toContain('undefined');
    expect(cabecerasDe()).toEqual({ Authorization: 'Bearer jwt', 'Content-Type': 'application/json' });
  });

  it('CA-RF13-06 si la zona cambia sin reiniciar, la petición nueva lleva la zona vigente', async () => {
    await request('/reportes/periodo', { token: 'jwt' });
    zonaDelDispositivo = 'America/Mexico_City';
    await request('/reportes/periodo', { token: 'jwt' });

    expect(cabecerasDe(0)['X-Zona-Horaria']).toBe('America/Bogota');
    expect(cabecerasDe(1)['X-Zona-Horaria']).toBe('America/Mexico_City');
  });

  it('CA-RF13-07 un 400 por zona inválida llega como ApiError con los mensajes unidos, sin reintentar', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        statusCode: 400,
        message: ['X-Zona-Horaria debe ser una zona horaria IANA válida'],
      }),
    });

    const error = await request('/reportes/periodo', { token: 'jwt' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'X-Zona-Horaria debe ser una zona horaria IANA válida',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
