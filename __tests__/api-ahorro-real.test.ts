import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { guardarAhorroReal, obtenerAhorroAcumulado, type AhorroAcumulado } from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';

// Contrato de GET /ahorro/acumulado y de PATCH /ahorro/metas/:id con `ahorroReal`
// (criterios/04-ahorro-real.md, CA-RF23-F32 a F34)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

const META_ID = '66a0f1c2d3e4f5a6b7c8d9e0';
const meta = {
  id: META_ID,
  tipoMeta: 'MONTO_FIJO' as const,
  valorObjetivo: 1500000,
  periodo: '2026-08',
  ahorroReal: 320000,
  creadaEn: '2026-08-01T15:00:00.000Z',
  actualizadaEn: '2026-09-17T15:00:00.000Z',
};
// Como responde el backend: de la meta más antigua a la más reciente, sin redondear y sin el id de la meta
const acumulado: AhorroAcumulado = {
  total: 170000.4,
  meses: [
    { periodo: '2026-06', ahorroReal: 250000.4, acumulado: 250000.4 },
    { periodo: '2026-08', ahorroReal: -80000, acumulado: 170000.4 },
  ],
};

describe('adaptador del ahorro anotado (lib/api/ahorro)', () => {
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

  it('CA-RF23-F32 obtenerAhorroAcumulado pide GET /ahorro/acumulado con solo "hasta", el JWT, sin cuerpo y sin Idempotency-Key', async () => {
    fetchMock.mockResolvedValue(respuesta(200, acumulado));

    await obtenerAhorroAcumulado('2026-09');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const direccion = new URL(url);
    expect(direccion.pathname).toMatch(/\/ahorro\/acumulado$/);
    expect(direccion.search).toBe('?hasta=2026-09');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    expect(init.body).toBeUndefined();
  });

  it.each([
    ['con meses, decimales, negativos y en el mismo orden', acumulado],
    ['sin metas', { total: 0, meses: [] }],
  ])(
    'CA-RF23-F32 obtenerAhorroAcumulado entrega la respuesta tal como llega (%s)',
    async (_caso, cuerpo) => {
      fetchMock.mockResolvedValue(respuesta(200, JSON.parse(JSON.stringify(cuerpo))));

      await expect(obtenerAhorroAcumulado('2026-09')).resolves.toEqual(cuerpo);
    },
  );

  it.each([320000, 0])(
    'CA-RF23-F33 guardarAhorroReal(id, %s) envía PATCH /ahorro/metas/:id con solo ahorroReal, sin clave, y entrega la meta',
    async (valor) => {
      const guardada = { ...meta, ahorroReal: valor };
      fetchMock.mockResolvedValue(respuesta(200, guardada));

      await expect(guardarAhorroReal(META_ID, valor)).resolves.toEqual(guardada);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(new RegExp(`/ahorro/metas/${META_ID}$`));
      expect(new URL(url).search).toBe('');
      expect(init.method).toBe('PATCH');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      // Número, no texto, y nada más en el cuerpo
      expect(JSON.parse(init.body)).toStrictEqual({ ahorroReal: valor });
    },
  );

  const llamadas: [string, () => Promise<unknown>][] = [
    ['obtenerAhorroAcumulado', () => obtenerAhorroAcumulado('2026-09')],
    ['guardarAhorroReal', () => guardarAhorroReal(META_ID, 320000)],
  ];

  it.each(llamadas.flatMap(([n, llamar]) => [400, 404, 500].map((s) => [n, s, llamar] as const)))(
    'CA-RF23-F34 %s: un %s llega como ApiError con su código y no cierra la sesión',
    async (_nombre, status, llamar) => {
      fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

      const falla = llamar();

      await expect(falla).rejects.toBeInstanceOf(ApiError);
      await expect(falla).rejects.toMatchObject({ status });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    },
  );

  it.each(llamadas)('CA-RF23-F34 %s: ante un 401 cierra la sesión', async (_nombre, llamar) => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(llamar()).rejects.toMatchObject({ status: 401 });
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it.each(llamadas)(
    'CA-RF23-F34 %s: sin respuesta del servidor llega un NetworkError',
    async (_nombre, llamar) => {
      fetchMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
      expect(alRechazarSesion).not.toHaveBeenCalled();
    },
  );
});
