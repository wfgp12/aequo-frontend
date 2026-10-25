import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError } from '@/lib/api/client';
import { listarCategorias } from '@/lib/api/categorias';
import { crearTransaccion } from '@/lib/api/transacciones';

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

const alimentacion = {
  id: 'c1',
  nombre: 'Alimentación',
  tipo: 'EGRESO',
  esPredeterminada: true,
  movimientos: 0,
};

describe('Adapters del registro', () => {
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

  describe('listarCategorias', () => {
    it('pide las categorías del tipo indicado y devuelve los items', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [alimentacion] }));

      await expect(listarCategorias('EGRESO')).resolves.toEqual([alimentacion]);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/categorias\?tipo=EGRESO$/);
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    });

    it('sin tipo pide todas', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));
      await listarCategorias();
      expect(fetchMock.mock.calls[0][0]).toMatch(/\/categorias$/);
    });

    it('ante un 401 cierra la sesión', async () => {
      fetchMock.mockResolvedValue(
        respuesta(401, { message: 'Sesión inválida o vencida', error: 'Unauthorized' }),
      );
      await expect(listarCategorias('EGRESO')).rejects.toBeInstanceOf(ApiError);
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });
  });

  describe('crearTransaccion', () => {
    const datos = {
      tipo: 'EGRESO' as const,
      monto: 45000,
      fecha: '2026-09-17',
      categoriaId: 'c1',
      metodoPago: 'DEBITO' as const,
      descripcion: 'almuerzo',
    };

    it('envía POST /transacciones con el contrato del backend y devuelve lo creado', async () => {
      const creada = { ...datos, id: 't1', clasificacionFlujo: 'ORDINARIO', creadaEn: 'x' };
      fetchMock.mockResolvedValue(respuesta(201, creada));

      await expect(crearTransaccion(datos)).resolves.toEqual(creada);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/transacciones$/);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(JSON.parse(init.body)).toEqual(datos);
    });

    it('une los mensajes del 400, que empiezan por el nombre del campo', async () => {
      fetchMock.mockResolvedValue(
        respuesta(400, {
          message: ['monto debe ser mayor que cero', 'fecha debe tener el formato YYYY-MM-DD'],
        }),
      );

      await expect(crearTransaccion(datos)).rejects.toMatchObject({
        status: 400,
        message: 'monto debe ser mayor que cero, fecha debe tener el formato YYYY-MM-DD',
      });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    });

    it('ante un 401 cierra la sesión', async () => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));
      await expect(crearTransaccion(datos)).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });
  });
});
