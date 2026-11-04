import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { actualizarTransaccion, eliminarTransaccion } from '@/lib/api/transacciones';

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

describe('edición y eliminación de transacciones (PATCH y DELETE /transacciones/:id)', () => {
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

  describe('actualizarTransaccion', () => {
    const actualizada = {
      id: 't1',
      tipo: 'EGRESO',
      monto: 50000,
      fecha: '2026-09-17',
      categoriaId: 'c1',
      metodoPago: 'DEBITO',
      descripcion: 'Almuerzo',
      clasificacionFlujo: 'ORDINARIO',
      creadaEn: 'x',
    };

    it('CA-RF08-25 envía PATCH /transacciones/:id con el JWT y solo los campos indicados', async () => {
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await expect(actualizarTransaccion('t1', { monto: 50000 })).resolves.toEqual(actualizada);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/transacciones\/t1$/);
      expect(init.method).toBe('PATCH');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({ monto: 50000 });
    });

    it('CA-RF08-25 no usa Idempotency-Key: el backend ya tolera repetir una edición', async () => {
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await actualizarTransaccion('t1', { monto: 50000 });

      expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Idempotency-Key');
    });

    it('CA-RF08-25 una descripción vacía viaja como texto vacío, no se omite', async () => {
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await actualizarTransaccion('t1', { descripcion: '' });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ descripcion: '' });
    });

    it('CA-RF08-25 el cambio de tipo viaja junto con la categoría', async () => {
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await actualizarTransaccion('t1', { tipo: 'INGRESO', categoriaId: 'c9' });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        tipo: 'INGRESO',
        categoriaId: 'c9',
      });
    });

    it('CA-RF08-25 une los mensajes del 400', async () => {
      fetchMock.mockResolvedValue(
        respuesta(400, {
          message: ['monto debe ser mayor que cero', 'categoriaId no corresponde al tipo'],
        }),
      );

      await expect(actualizarTransaccion('t1', { monto: 0 })).rejects.toMatchObject({
        status: 400,
        message: 'monto debe ser mayor que cero, categoriaId no corresponde al tipo',
      });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    });

    it.each([404, 409])(
      'CA-RF08-25 un %s llega como ApiError y no cierra la sesión',
      async (status) => {
        fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

        await expect(actualizarTransaccion('t1', { monto: 1 })).rejects.toMatchObject({ status });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it('CA-RF08-25 ante un 401 cierra la sesión', async () => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(actualizarTransaccion('t1', { monto: 1 })).rejects.toMatchObject({
        status: 401,
      });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });
  });

  describe('eliminarTransaccion', () => {
    it('CA-RF08-26 envía DELETE /transacciones/:id con el JWT, sin cuerpo y sin clave, y resuelve con 204', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      // Con 204 no hay nada que devolver: basta con que no falle
      await eliminarTransaccion('t1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/transacciones\/t1$/);
      expect(init.method).toBe('DELETE');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it.each([404, 409])(
      'CA-RF08-26 un %s llega como ApiError y no cierra la sesión',
      async (status) => {
        fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

        await expect(eliminarTransaccion('t1')).rejects.toMatchObject({ status });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it('CA-RF08-26 ante un 401 cierra la sesión', async () => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(eliminarTransaccion('t1')).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });
  });
});
