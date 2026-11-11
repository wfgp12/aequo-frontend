import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerReporteCategorias } from '@/lib/api/reportes';

// Contrato de GET /reportes/categorias (criterios/03-reportes-por-categoria.md, CA-RF18-11 a 18)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('obtenerReporteCategorias (GET /reportes/categorias)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const reporte = {
    desde: '2026-10-01',
    hasta: '2026-10-31',
    total: 1500000.5,
    categorias: [
      { categoriaId: '665f1c2e9b1d4a0012ab3a01', nombre: 'Alimentación', total: 1000000.25, porcentaje: 66.6666 },
      { categoriaId: null, nombre: 'Sin categoría', total: 500000.25, porcentaje: 33.3333 },
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

  it('CA-RF18-11 sin periodo pide GET /reportes/categorias sin parámetros y con el JWT propio', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteCategorias();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/reportes\/categorias$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
  });

  it('CA-RF18-12 un mes concreto se envía como mes, sin desde ni hasta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteCategorias({ mes: '2026-09' });

    const url = urlPedida();
    expect(url.pathname).toMatch(/\/reportes\/categorias$/);
    expect(url.search).toBe('?mes=2026-09');
    expect(url.searchParams.has('desde')).toBe(false);
    expect(url.searchParams.has('hasta')).toBe(false);
  });

  it('CA-RF18-13 un rango se envía como desde y hasta, sin mes', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    await obtenerReporteCategorias({ desde: '2026-10-10', hasta: '2026-10-20' });

    const url = urlPedida();
    expect(url.pathname).toMatch(/\/reportes\/categorias$/);
    expect(url.searchParams.get('desde')).toBe('2026-10-10');
    expect(url.searchParams.get('hasta')).toBe('2026-10-20');
    expect(url.searchParams.has('mes')).toBe(false);
  });

  it('CA-RF18-14 entrega el reporte tal como llega, en el mismo orden y sin redondear ni recalcular', async () => {
    fetchMock.mockResolvedValue(respuesta(200, reporte));

    const resultado = await obtenerReporteCategorias();

    expect(resultado).toEqual(reporte);
    expect(resultado.total).toBe(1500000.5);
    expect(resultado.categorias.map((c) => c.nombre)).toEqual(['Alimentación', 'Sin categoría']);
    expect(resultado.categorias[0].total).toBe(1000000.25);
    expect(resultado.categorias[0].porcentaje).toBe(66.6666);
    expect(resultado.categorias[1].categoriaId).toBeNull();
    expect(resultado.categorias[1].porcentaje).toBe(33.3333);
  });

  it('CA-RF18-15 un 400 llega como ApiError con los mensajes unidos y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { message: ['mes debe tener el formato YYYY-MM con un mes del 01 al 12'] }),
    );

    const falla = obtenerReporteCategorias({ mes: '2026-13' });

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({
      status: 400,
      message: 'mes debe tener el formato YYYY-MM con un mes del 01 al 12',
    });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF18-15 si el 400 trae varios mensajes, los une con coma', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { message: ['desde es obligatorio', 'hasta es obligatorio'] }));

    await expect(obtenerReporteCategorias({ desde: '2026-10-10', hasta: '' })).rejects.toMatchObject({
      status: 400,
      message: 'desde es obligatorio, hasta es obligatorio',
    });
  });

  it('CA-RF18-16 un 401 cierra la sesión local y llega como ApiError 401', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(obtenerReporteCategorias()).rejects.toMatchObject({ status: 401 });

    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF18-16 sin sesión no llama al backend', async () => {
    registrarManejadorDeSesion({ obtenerSesion: () => null, alRechazarSesion });

    await expect(obtenerReporteCategorias()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF18-16 con la sesión vencida localmente no llama al backend', async () => {
    registrarManejadorDeSesion({
      obtenerSesion: () => ({ accessToken: 'jwt-viejo', expiraEn: Date.now() - 1000 }),
      alRechazarSesion,
    });

    await expect(obtenerReporteCategorias({ mes: '2026-09' })).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF18-17 sin conexión llega un NetworkError y no cierra la sesión', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(obtenerReporteCategorias()).rejects.toBeInstanceOf(NetworkError);
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF18-18 un 500 llega como ApiError 500 y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'Error interno' }));

    const falla = obtenerReporteCategorias();

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({ status: 500 });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
