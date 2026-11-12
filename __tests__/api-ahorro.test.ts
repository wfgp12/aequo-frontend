import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { actualizarMeta, crearMeta, eliminarMeta, obtenerMetaDelMes } from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';

// Contrato de /ahorro/metas (criterios/04-ahorro-meta.md, CA-RF21-F46 a F50)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

// 204: el backend responde sin cuerpo, así que leerlo como JSON falla
const sinCuerpo = {
  ok: true,
  status: 204,
  statusText: 'No Content',
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
};

describe('adaptador de la meta de ahorro (/ahorro/metas)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
  const meta = {
    id: '66a0f1c2d3e4f5a6b7c8d9e0',
    tipoMeta: 'MONTO_FIJO' as const,
    valorObjetivo: 1500000,
    periodo: '2026-09',
    ahorroReal: 0,
    creadaEn: '2026-09-17T15:00:00.000Z',
    actualizadaEn: '2026-09-17T15:00:00.000Z',
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

  describe('obtenerMetaDelMes', () => {
    it('CA-RF21-F46 pide GET /ahorro/metas con el mes en desde y hasta, el JWT y sin cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [meta] }));

      await obtenerMetaDelMes('2026-09');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(/\/ahorro\/metas$/);
      expect(direccion.search).toBe('?desde=2026-09&hasta=2026-09');
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF21-F46 entrega la meta tal cual la responde el backend, sin cambiar ni redondear nada', async () => {
      const conDecimales = {
        ...meta,
        tipoMeta: 'PORCENTAJE' as const,
        valorObjetivo: 12.555,
        ahorroReal: 33.333,
      };
      fetchMock.mockResolvedValue(respuesta(200, { items: [conDecimales] }));

      await expect(obtenerMetaDelMes('2026-09')).resolves.toEqual(conDecimales);
    });

    it('CA-RF21-F46 si no hay meta del mes (items vacío) entrega null', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await expect(obtenerMetaDelMes('2026-09')).resolves.toBeNull();
    });

    it('CA-RF21-F46 otro mes se pide en desde y hasta', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await obtenerMetaDelMes('2025-12');

      expect(new URL(fetchMock.mock.calls[0][0]).search).toBe('?desde=2025-12&hasta=2025-12');
    });
  });

  describe('crearMeta', () => {
    const datos = { tipoMeta: 'MONTO_FIJO' as const, valorObjetivo: 1500000, periodo: '2026-09' };

    it('CA-RF21-F47 envía POST /ahorro/metas con el JWT, la clave en el header y solo tipoMeta, valorObjetivo y periodo en el cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, meta));

      await expect(crearMeta(datos, clave)).resolves.toEqual(meta);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/ahorro\/metas$/);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datos);
      expect(init.body).not.toContain(clave);
    });

    it('CA-RF21-F47 el valor del porcentaje viaja como número, no como texto', async () => {
      fetchMock.mockResolvedValue(
        respuesta(201, { ...meta, tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5 }),
      );

      await crearMeta({ tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5, periodo: '2026-09' }, clave);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo).toEqual({ tipoMeta: 'PORCENTAJE', valorObjetivo: 12.5, periodo: '2026-09' });
      expect(typeof cuerpo.valorObjetivo).toBe('number');
    });

    it('CA-RF21-F47 cada llamada lleva la clave que recibe: la misma en un reintento y otra en una acción nueva', async () => {
      fetchMock.mockResolvedValue(respuesta(201, meta));
      const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';

      await crearMeta(datos, clave);
      await crearMeta(datos, clave);
      await crearMeta(datos, otraClave);

      const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
      expect(claves).toEqual([clave, clave, otraClave]);
    });
  });

  describe('actualizarMeta', () => {
    const cambios = { tipoMeta: 'PORCENTAJE' as const, valorObjetivo: 20 };

    it('CA-RF21-F48 envía PATCH /ahorro/metas/:id con el JWT, sin clave y solo tipoMeta y valorObjetivo en el cuerpo', async () => {
      const actualizada = { ...meta, ...cambios };
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await expect(actualizarMeta(meta.id, cambios)).resolves.toEqual(actualizada);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(new RegExp(`/ahorro/metas/${meta.id}$`));
      expect(init.method).toBe('PATCH');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(JSON.parse(init.body)).toEqual(cambios);
    });
  });

  describe('eliminarMeta', () => {
    it('CA-RF21-F49 envía DELETE /ahorro/metas/:id con el JWT, sin cuerpo y sin clave, y termina con el 204 sin entregar nada', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      // Con 204 no hay nada que devolver: basta con que no falle
      await eliminarMeta(meta.id);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(new RegExp(`/ahorro/metas/${meta.id}$`));
      expect(init.method).toBe('DELETE');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });
  });

  describe('errores del backend (las cuatro funciones)', () => {
    const llamadas: [string, () => Promise<unknown>][] = [
      ['obtenerMetaDelMes', () => obtenerMetaDelMes('2026-09')],
      [
        'crearMeta',
        () =>
          crearMeta({ tipoMeta: 'MONTO_FIJO', valorObjetivo: 1500000, periodo: '2026-09' }, clave),
      ],
      [
        'actualizarMeta',
        () => actualizarMeta(meta.id, { tipoMeta: 'MONTO_FIJO', valorObjetivo: 1 }),
      ],
      ['eliminarMeta', () => eliminarMeta(meta.id)],
    ];

    it.each(llamadas)(
      'CA-RF21-F50 %s une los mensajes del 400 y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(400, {
            message: ['valorObjetivo debe ser mayor que 0', 'tipoMeta debe ser un valor válido'],
          }),
        );

        await expect(llamar()).rejects.toMatchObject({
          status: 400,
          message: 'valorObjetivo debe ser mayor que 0, tipoMeta debe ser un valor válido',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(llamadas)(
      'CA-RF21-F50 %s: el 404 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(404, { message: 'Meta de ahorro no encontrada' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 404,
          message: 'Meta de ahorro no encontrada',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(llamadas)(
      'CA-RF21-F50 %s: el 409 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(409, { message: 'Ya existe una meta de ahorro para ese mes' }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 409,
          message: 'Ya existe una meta de ahorro para ese mes',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(
      llamadas.flatMap(([nombre, llamar]) => [422, 500].map((s) => [nombre, s, llamar] as const)),
    )(
      'CA-RF21-F50 %s: un %s llega como ApiError con su código y no cierra la sesión',
      async (_nombre, status, llamar) => {
        fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

        await expect(llamar()).rejects.toMatchObject({ status });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(llamadas)('CA-RF21-F50 %s: ante un 401 cierra la sesión', async (_nombre, llamar) => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(llamar()).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });

    it.each(llamadas)(
      'CA-RF21-F50 %s: sin respuesta del servidor llega un NetworkError',
      async (_nombre, llamar) => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );
  });
});
