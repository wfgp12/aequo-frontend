import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { obtenerProgresoAhorro } from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';

// Contrato de GET /ahorro/progreso (criterios/04-ahorro-progreso.md, CA-RF22-F33 a F35)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('adaptador del progreso del ahorro (GET /ahorro/progreso)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const conMeta = {
    periodo: '2026-09',
    ingresoPropio: 2200000,
    egresos: 119802.13,
    ahorroDelMes: 2080197.87,
    meta: {
      id: '66a0f1c2d3e4f5a6b7c8d9e0',
      tipoMeta: 'PORCENTAJE',
      valorObjetivo: 12.5,
      montoMeta: 287500,
    },
    disponible: 1792697.87,
    porcentajeAvance: 723.6138,
  };
  const sinMeta = {
    periodo: '2026-09',
    ingresoPropio: 300000,
    egresos: 0,
    ahorroDelMes: 300000,
    meta: null,
    disponible: 300000,
    porcentajeAvance: null,
  };

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

  it('CA-RF22-F33 pide GET /ahorro/progreso con solo el mes, el JWT, sin cuerpo y sin Idempotency-Key', async () => {
    fetchMock.mockResolvedValue(respuesta(200, conMeta));

    await obtenerProgresoAhorro('2026-09');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const direccion = new URL(url);
    expect(direccion.pathname).toMatch(/\/ahorro\/progreso$/);
    expect(direccion.search).toBe('?mes=2026-09');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    expect(init.body).toBeUndefined();
  });

  it('CA-RF22-F33 otro mes se pide en el mismo parámetro', async () => {
    fetchMock.mockResolvedValue(respuesta(200, sinMeta));

    await obtenerProgresoAhorro('2025-12');

    expect(new URL(fetchMock.mock.calls[0][0]).search).toBe('?mes=2025-12');
  });

  it('CA-RF22-F34 entrega la respuesta con meta tal cual, con los decimales intactos', async () => {
    fetchMock.mockResolvedValue(respuesta(200, conMeta));

    const progreso = await obtenerProgresoAhorro('2026-09');

    expect(progreso).toEqual(conMeta);
    expect(progreso.porcentajeAvance).toBe(723.6138);
    expect(progreso.egresos).toBe(119802.13);
  });

  it('CA-RF22-F34 entrega la respuesta sin meta (meta y porcentaje null) sin cambiar nada', async () => {
    fetchMock.mockResolvedValue(respuesta(200, sinMeta));

    const progreso = await obtenerProgresoAhorro('2026-09');

    expect(progreso).toEqual(sinMeta);
    expect(progreso.meta).toBeNull();
    expect(progreso.porcentajeAvance).toBeNull();
  });

  it('CA-RF22-F34 un porcentaje negativo o mayor a 100 llega sin tope', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { ...conMeta, porcentajeAvance: -125 }));
    await expect(obtenerProgresoAhorro('2026-09')).resolves.toMatchObject({
      porcentajeAvance: -125,
    });

    fetchMock.mockResolvedValue(respuesta(200, { ...conMeta, porcentajeAvance: 166.6667 }));
    await expect(obtenerProgresoAhorro('2026-09')).resolves.toMatchObject({
      porcentajeAvance: 166.6667,
    });
  });

  describe('errores del backend', () => {
    it('CA-RF22-F35 un 400 llega como ApiError con los mensajes unidos y no cierra la sesión', async () => {
      fetchMock.mockResolvedValue(
        respuesta(400, { message: ['mes debe tener el formato YYYY-MM', 'mes es obligatorio'] }),
      );

      const falla = obtenerProgresoAhorro('2026-9');

      await expect(falla).rejects.toBeInstanceOf(ApiError);
      await expect(falla).rejects.toMatchObject({
        status: 400,
        message: 'mes debe tener el formato YYYY-MM, mes es obligatorio',
      });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    });

    it('CA-RF22-F35 un 500 llega como ApiError con su código y no cierra la sesión', async () => {
      fetchMock.mockResolvedValue(respuesta(500, { message: 'x' }));

      const falla = obtenerProgresoAhorro('2026-09');

      await expect(falla).rejects.toBeInstanceOf(ApiError);
      await expect(falla).rejects.toMatchObject({ status: 500 });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    });

    it('CA-RF22-F35 un 401 cierra la sesión', async () => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(obtenerProgresoAhorro('2026-09')).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });

    it('CA-RF22-F35 sin respuesta del servidor llega un NetworkError', async () => {
      fetchMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(obtenerProgresoAhorro('2026-09')).rejects.toBeInstanceOf(NetworkError);
      expect(alRechazarSesion).not.toHaveBeenCalled();
    });
  });
});
