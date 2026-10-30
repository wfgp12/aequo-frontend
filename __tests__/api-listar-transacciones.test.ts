import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { listarTransacciones } from '@/lib/api/transacciones';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('listarTransacciones (GET /transacciones)', () => {
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

  it('CA-RF02-01 sin filtros pide GET /transacciones con el JWT propio y devuelve la página', async () => {
    const pagina = { items: [], siguienteCursor: null };
    fetchMock.mockResolvedValue(respuesta(200, pagina));

    await expect(listarTransacciones()).resolves.toEqual(pagina);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/transacciones$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('CA-RF02-01 envía desde, hasta, límite y cursor como parámetros, tal cual', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [], siguienteCursor: null }));

    await listarTransacciones({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      limite: 50,
      cursor: 'abc=',
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toMatch(/\/transacciones$/);
    expect(url.searchParams.get('desde')).toBe('2026-09-01');
    expect(url.searchParams.get('hasta')).toBe('2026-09-30');
    expect(url.searchParams.get('limite')).toBe('50');
    expect(url.searchParams.get('cursor')).toBe('abc=');
  });

  it('CA-RF02-01 omite los filtros vacíos o sin definir', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [], siguienteCursor: null }));

    await listarTransacciones({ desde: '', hasta: undefined, cursor: '' });

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/transacciones$/);
  });

  it('CA-RF02-01 un filtro sí enviado no arrastra a los omitidos', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [], siguienteCursor: null }));

    await listarTransacciones({ desde: '', hasta: '2026-10-29' });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('hasta')).toBe('2026-10-29');
    expect(url.searchParams.has('desde')).toBe(false);
    expect(url.searchParams.has('limite')).toBe(false);
    expect(url.searchParams.has('cursor')).toBe(false);
  });

  it('CA-RF02-01 ante un 401 cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(listarTransacciones()).rejects.toMatchObject({ status: 401 });

    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF02-01 un 400 llega con el mensaje del backend y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { message: ['desde no puede ser posterior a hasta'] }),
    );

    await expect(
      listarTransacciones({ desde: '2026-10-01', hasta: '2026-09-01' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'desde no puede ser posterior a hasta',
    });

    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
