import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { crearCategoria } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';

// Contrato de POST /categorias (criterios/02-categorias-crear.md, CA-RF10-F23 y F24)
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('crearCategoria (POST /categorias)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const datos = { nombre: 'Mascotas', tipo: 'EGRESO' as const };
  const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
  const creada = { id: 'c20', ...datos, esPredeterminada: false, movimientos: 0 };

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

  it('CA-RF10-F23 envía POST /categorias con el JWT, la clave en el header y solo nombre y tipo en el cuerpo', async () => {
    fetchMock.mockResolvedValue(respuesta(201, creada));

    await expect(crearCategoria(datos, clave)).resolves.toEqual(creada);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/categorias$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toBe(clave);
    expect(JSON.parse(init.body)).toEqual(datos);
    expect(init.body).not.toContain(clave);
  });

  it('CA-RF10-F23 envía el tipo INGRESO tal como lo recibe', async () => {
    fetchMock.mockResolvedValue(respuesta(201, { ...creada, tipo: 'INGRESO' }));

    await crearCategoria({ nombre: 'Becas', tipo: 'INGRESO' }, clave);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nombre: 'Becas', tipo: 'INGRESO' });
  });

  it('CA-RF10-F23 cada llamada lleva la clave que recibe: la misma en un reintento y otra en una acción nueva', async () => {
    fetchMock.mockResolvedValue(respuesta(201, creada));
    const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';

    await crearCategoria(datos, clave);
    await crearCategoria(datos, clave);
    await crearCategoria(datos, otraClave);

    const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
    expect(claves).toEqual([clave, clave, otraClave]);
  });

  it('CA-RF10-F24 une los mensajes del 400 y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, {
        message: ['nombre no puede estar vacío', 'nombre debe tener máximo 40 caracteres'],
      }),
    );

    await expect(crearCategoria(datos, clave)).rejects.toMatchObject({
      status: 400,
      message: 'nombre no puede estar vacío, nombre debe tener máximo 40 caracteres',
    });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF10-F24 el 409 de nombre repetido llega como ApiError 409 con el mensaje del backend y no cierra la sesión', async () => {
    fetchMock.mockResolvedValue(
      respuesta(409, { message: 'Ya existe una categoría con ese nombre' }),
    );

    const falla = crearCategoria(datos, clave);

    await expect(falla).rejects.toBeInstanceOf(ApiError);
    await expect(falla).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe una categoría con ese nombre',
    });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it.each([422, 500])('CA-RF10-F24 un %s llega como ApiError con su código y no cierra la sesión', async (status) => {
    fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

    await expect(crearCategoria(datos, clave)).rejects.toMatchObject({ status });
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });

  it('CA-RF10-F24 ante un 401 cierra la sesión', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

    await expect(crearCategoria(datos, clave)).rejects.toMatchObject({ status: 401 });
    expect(alRechazarSesion).toHaveBeenCalledTimes(1);
  });

  it('CA-RF10-F24 sin respuesta del servidor llega un NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(crearCategoria(datos, clave)).rejects.toBeInstanceOf(NetworkError);
    expect(alRechazarSesion).not.toHaveBeenCalled();
  });
});
