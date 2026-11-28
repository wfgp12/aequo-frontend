import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { eliminarPrestamo, listarDeudas, registrarPrestamo } from '@/lib/api/deudas';

// Contrato de los préstamos recibidos: POST /deudas/prestamos, GET /deudas y
// DELETE /deudas/:deudaId/prestamos/:prestamoId (criterios/06-prestamos.md, CA-RF34-F27 a F29;
// coordinacion/contratos/deudas.md). El backend se simula con `fetch`.
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

const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
const datos = {
  acreedor: 'Juan',
  monto: 500000,
  fecha: '2026-11-28',
  descripcion: 'Para el arriendo',
  tipoInteres: 'TASA' as const,
  valorInteres: 0.02,
};
const deuda = {
  id: 'deuda-1',
  acreedor: 'Juan',
  tipoInteres: 'TASA',
  valorInteres: 0.02,
  saldada: false,
  creadaEn: '2026-11-28T15:00:00.000Z',
};
const prestamo = {
  id: 'p-1',
  monto: 500000.5,
  fecha: '2026-11-28',
  descripcion: 'Para el arriendo',
  creadaEn: '2026-11-28T15:00:00.000Z',
};

describe('adaptador de préstamos (/deudas)', () => {
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

  const peticion = () => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    return { direccion: new URL(url), init };
  };

  it('CA-RF34-F27 registrarPrestamo envía POST /deudas/prestamos con el JWT, la clave y exactamente los datos, y entrega el 201', async () => {
    const cuerpo201 = { deudaCreada: true, deuda, prestamo };
    fetchMock.mockResolvedValue(respuesta(201, cuerpo201));

    const entregado = await registrarPrestamo(datos, clave);

    const { direccion, init } = peticion();
    expect(direccion.pathname).toMatch(/\/deudas\/prestamos$/);
    expect(direccion.search).toBe('');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers['Idempotency-Key']).toBe(clave);
    expect(JSON.parse(init.body)).toStrictEqual(datos);
    expect(entregado).toEqual(cuerpo201);
  });

  it('CA-RF34-F27 registrarPrestamo no agrega campos que no recibe', async () => {
    const minimos = { acreedor: 'Papá', monto: 200000, fecha: '2026-11-27' };
    fetchMock.mockResolvedValue(respuesta(201, { deudaCreada: false, deuda, prestamo }));

    await registrarPrestamo(minimos, clave);

    expect(JSON.parse(peticion().init.body)).toStrictEqual(minimos);
  });

  it('CA-RF34-F28 listarDeudas pide GET /deudas y entrega items en su orden y sin redondear', async () => {
    const items = [
      { ...deuda, id: 'deuda-z', acreedor: 'Zoe', prestamos: [prestamo] },
      { ...deuda, id: 'deuda-a', acreedor: 'Ana', prestamos: [] },
    ];
    fetchMock.mockResolvedValue(respuesta(200, { items }));

    const entregado = await listarDeudas();

    const { direccion, init } = peticion();
    expect(direccion.pathname).toMatch(/\/deudas$/);
    expect(direccion.search).toBe('');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    expect(init.body).toBeUndefined();
    expect(entregado).toEqual(items);
    expect(entregado[0].prestamos[0].monto).toBe(500000.5);
  });

  it('CA-RF34-F28 listarDeudas sin deudas entrega un arreglo vacío', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

    await expect(listarDeudas()).resolves.toEqual([]);
  });

  it('CA-RF34-F29 eliminarPrestamo envía DELETE sin cuerpo y termina bien con el 204', async () => {
    fetchMock.mockResolvedValue(sinCuerpo);

    await expect(eliminarPrestamo('deuda-1', 'p-1')).resolves.toBeFalsy();

    const { direccion, init } = peticion();
    expect(direccion.pathname).toMatch(/\/deudas\/deuda-1\/prestamos\/p-1$/);
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.body).toBeUndefined();
  });

  const FUNCIONES: [string, () => Promise<unknown>][] = [
    ['registrarPrestamo', () => registrarPrestamo(datos, clave)],
    ['listarDeudas', () => listarDeudas()],
    ['eliminarPrestamo', () => eliminarPrestamo('deuda-1', 'p-1')],
  ];

  it.each(FUNCIONES)(
    'CA-RF34-F29 %s entrega el error del backend como ApiError con su estado y code',
    async (_nombre, llamar) => {
      fetchMock.mockResolvedValue(
        respuesta(409, { statusCode: 409, message: 'x', code: 'DEUDA_CON_ABONOS' }),
      );

      const error = await llamar().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'DEUDA_CON_ABONOS' });
    },
  );

  it.each(FUNCIONES)('CA-RF34-F29 %s sin conexión entrega NetworkError', async (_n, llamar) => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
  });
});
