import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerReporteEvolucion } from '@/lib/api/reportes';

// Contrato de GET /reportes/evolucion (criterios/03-reportes-evolucion.md, CA-RF19-09 a 17)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('obtenerReporteEvolucion (GET /reportes/evolucion)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const reporte = {
    desde: '2026-07',
    hasta: '2026-10',
    puntos: [
      { periodo: '2026-07', balance: 2000000 },
      { periodo: '2026-08', balance: 0 },
      { periodo: '2026-09', balance: -250000.5 },
      { periodo: '2026-10', balance: 699.7 },
    ],
  };

  const urlPedida = () => new URL(fetchMock.mock.calls[0][0]);

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

  it('CA-RF19-09 sin periodo pide GET /reportes/evolucion sin parámetros y con el JWT propio', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/reportes\/evolucion$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('CA-RF19-09 con un objeto vacío tampoco envía parámetros', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion({});

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/reportes\/evolucion$/);
  });

  it('CA-RF19-10 un rango se envía como desde y hasta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion({ desde: '2026-04', hasta: '2026-09' });

    const url = urlPedida();
    expect(url.pathname).toMatch(/\/reportes\/evolucion$/);
    expect(url.search).toBe('?desde=2026-04&hasta=2026-09');
  });

  it('CA-RF19-11 solo desde se envía sin hasta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion({ desde: '2026-04' });

    expect(urlPedida().search).toBe('?desde=2026-04');
    expect(urlPedida().searchParams.has('hasta')).toBe(false);
  });

  it('CA-RF19-11 solo hasta se envía sin desde', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion({ hasta: '2026-09' });

    expect(urlPedida().search).toBe('?hasta=2026-09');
    expect(urlPedida().searchParams.has('desde')).toBe(false);
  });

  it('CA-RF19-11 un extremo undefined no se envía y nunca aparece el texto undefined', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteEvolucion({ desde: undefined, hasta: '2026-09' });

    expect(fetchMock.mock.calls[0][0]).not.toContain('undefined');
    expect(urlPedida().search).toBe('?hasta=2026-09');
  });

  it('CA-RF19-12 entrega la respuesta tal como llega, sin redondear, reordenar ni rellenar', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    const resultado = await obtenerReporteEvolucion({ desde: '2026-07', hasta: '2026-10' });

    expect(resultado).toEqual(reporte);
    expect(resultado.desde).toBe('2026-07');
    expect(resultado.hasta).toBe('2026-10');
    expect(resultado.puntos.map((p) => p.periodo)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(resultado.puntos.map((p) => p.balance)).toEqual([2000000, 0, -250000.5, 699.7]);
  });

  it('CA-RF19-13 sin movimientos y sin rango llega vacío y no es error', async () => {
    const vacio = { desde: null, hasta: null, puntos: [] };
    fetchMock.mockResolvedValue(respuesta(200, vacio));

    await expect(obtenerReporteEvolucion()).resolves.toEqual(vacio);
  });

  it('CA-RF19-13 con rango y sin movimientos llega vacío con los extremos enviados', async () => {
    const vacio = { desde: '2026-04', hasta: '2026-09', puntos: [] };
    fetchMock.mockResolvedValue(respuesta(200, vacio));

    await expect(obtenerReporteEvolucion({ desde: '2026-04', hasta: '2026-09' })).resolves.toEqual(vacio);
  });

  it('CA-RF19-14 un 400 llega como ApiError con el texto del backend y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { message: ['desde no puede ser posterior a hasta'] }));

    const falla = obtenerReporteEvolucion({ desde: '2026-09', hasta: '2026-04' });

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({ status: 400, message: 'desde no puede ser posterior a hasta' });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF19-14 si el 400 trae varios mensajes, los une con coma', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { message: ['desde debe ser un mes', 'hasta debe ser un mes'] }));

    await expect(obtenerReporteEvolucion({ desde: 'x', hasta: 'y' })).rejects.toMatchObject({
      status: 400,
      message: 'desde debe ser un mes, hasta debe ser un mes',
    });
  });

  it('CA-RF19-15 un 401 cierra la sesión local y llega como ApiError 401', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(obtenerReporteEvolucion()).rejects.toMatchObject({ status: 401 });

    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF19-15 sin sesión no llama al backend', async () => {
    registrarManejadorDeSesion({ obtenerSesion: () => null, alRechazarSesion });

    await expect(obtenerReporteEvolucion()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF19-15 con la sesión vencida localmente no llama al backend', async () => {
    registrarManejadorDeSesion({
      obtenerSesion: () => ({ accessToken: 'jwt-viejo', expiraEn: Date.now() - 1000 }),
      alRechazarSesion,
    });

    await expect(obtenerReporteEvolucion({ desde: '2026-04', hasta: '2026-09' })).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF19-16 sin conexión llega un NetworkError y no cierra la sesión', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(obtenerReporteEvolucion()).rejects.toBeInstanceOf(NetworkError);
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF19-17 un 500 llega como ApiError 500 y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'Error interno' }));

    const falla = obtenerReporteEvolucion();

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({ status: 500 });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
