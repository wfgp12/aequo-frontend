import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { eliminarCategoria, renombrarCategoria } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';

// Contrato de PATCH y DELETE /categorias/:id (criterios/02-categorias-gestion.md, CA-RF11-F21 y CA-RF12-F09)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}
/** Un 204 no trae cuerpo: leerlo como JSON falla. */
const sinContenido = () => ({
  ok: true,
  status: 204,
  statusText: 'No Content',
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
});

const fetchMock = jest.fn();
const alRechazarSesion = jest.fn();
const id = '66f0a1b2c3d4e5f601234567';

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

describe.each([
  ['CA-RF11-F21', 'renombrarCategoria', () => renombrarCategoria(id, 'Animales')],
  ['CA-RF12-F09', 'eliminarCategoria', () => eliminarCategoria(id)],
])('%s %s: errores', (criterio, _nombre, llamar) => {
  it.each([400, 403, 404, 409, 500])(
    `${criterio} un %s llega como ApiError con su código y no cierra la sesión`,
    async (status) => {
      fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

      const falla = llamar();

      await expect(falla).rejects.toBeInstanceOf(ApiError);
      await expect(falla).rejects.toMatchObject({ status });
      expect(alRechazarSesion).not.toHaveBeenCalled();
    },
  );

  it(`${criterio} ante un 401 cierra la sesión`, async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(llamar()).rejects.toMatchObject({ status: 401 });
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it(`${criterio} sin respuesta del servidor llega un NetworkError`, async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});

describe('Peticiones según el contrato', () => {
  it('CA-RF11-F21 envía PATCH /categorias/:id con el JWT, solo el nombre y sin clave de idempotencia', async () => {
    const guardada = {
      id,
      nombre: 'Animales',
      tipo: 'EGRESO',
      esPredeterminada: false,
      movimientos: 12,
    };
    fetchMock.mockResolvedValue(respuesta(200, guardada));

    await expect(renombrarCategoria(id, 'Animales')).resolves.toEqual(guardada);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/categorias/${id}$`));
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    expect(JSON.parse(init.body)).toEqual({ nombre: 'Animales' });
  });

  it('CA-RF12-F09 envía DELETE /categorias/:id sin cuerpo y acepta el 204', async () => {
    fetchMock.mockResolvedValue(sinContenido());

    await eliminarCategoria(id);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/categorias/${id}$`));
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.body).toBeUndefined();
  });
});
