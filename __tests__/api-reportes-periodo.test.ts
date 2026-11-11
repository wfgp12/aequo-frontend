import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerReportePeriodo } from '@/lib/api/reportes';

// Contrato de GET /reportes/periodo (criterios/03-reportes-ingresos-egresos.md, CA-RF17-14 a 21)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('obtenerReportePeriodo (GET /reportes/periodo)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const reporte = {
    desde: '2026-10-01',
    hasta: '2026-10-31',
    ingresos: 2800000,
    egresos: 1379700.5,
    pagosTarjeta: 119802.13,
    abonosDeuda: 200000,
    dineroRecibido: 1000000,
    balance: 1100497.37,
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

  it('CA-RF17-14 sin periodo pide GET /reportes/periodo sin parámetros y con el JWT propio', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReportePeriodo();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/reportes\/periodo$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('CA-RF17-15 un mes concreto se envía como mes, sin desde ni hasta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReportePeriodo({ mes: '2026-09' });

    const url = urlPedida();
    expect(url.pathname).toMatch(/\/reportes\/periodo$/);
    expect(url.search).toBe('?mes=2026-09');
    expect(url.searchParams.has('desde')).toBe(false);
    expect(url.searchParams.has('hasta')).toBe(false);
  });

  it('CA-RF17-16 un rango se envía como desde y hasta, sin mes', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReportePeriodo({ desde: '2026-10-10', hasta: '2026-10-20' });

    const url = urlPedida();
    expect(url.pathname).toMatch(/\/reportes\/periodo$/);
    expect(url.searchParams.get('desde')).toBe('2026-10-10');
    expect(url.searchParams.get('hasta')).toBe('2026-10-20');
    expect(url.searchParams.has('mes')).toBe(false);
  });

  it('CA-RF17-17 entrega los ocho campos tal como llegan, sin redondear ni recalcular', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    const resultado = await obtenerReportePeriodo();

    expect(resultado).toEqual(reporte);
    expect(resultado.egresos).toBe(1379700.5);
    expect(resultado.pagosTarjeta).toBe(119802.13);
    expect(resultado.balance).toBe(1100497.37);
  });

  it('CA-RF17-18 un 400 llega como ApiError con los mensajes unidos y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { message: ['mes debe tener el formato YYYY-MM con un mes del 01 al 12'] }),
    );

    const falla = obtenerReportePeriodo({ mes: '2026-13' });

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({
      status: 400,
      message: 'mes debe tener el formato YYYY-MM con un mes del 01 al 12',
    });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF17-18 si el 400 trae varios mensajes, los une con coma', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { message: ['desde es obligatorio', 'hasta es obligatorio'] }));

    await expect(obtenerReportePeriodo({ desde: '2026-10-10', hasta: '' })).rejects.toMatchObject({
      status: 400,
      message: 'desde es obligatorio, hasta es obligatorio',
    });
  });

  it('CA-RF17-19 un 401 cierra la sesión local y llega como ApiError 401', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(obtenerReportePeriodo()).rejects.toMatchObject({ status: 401 });

    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF17-19 sin sesión no llama al backend', async () => {
    registrarManejadorDeSesion({ obtenerSesion: () => null, alRechazarSesion });

    await expect(obtenerReportePeriodo()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF17-19 con la sesión vencida localmente no llama al backend', async () => {
    registrarManejadorDeSesion({
      obtenerSesion: () => ({ accessToken: 'jwt-viejo', expiraEn: Date.now() - 1000 }),
      alRechazarSesion,
    });

    await expect(obtenerReportePeriodo({ mes: '2026-09' })).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF17-20 sin conexión llega un NetworkError y no cierra la sesión', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(obtenerReportePeriodo()).rejects.toBeInstanceOf(NetworkError);
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF17-21 un 500 llega como ApiError 500 y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'Error interno' }));

    const falla = obtenerReportePeriodo();

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({ status: 500 });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
