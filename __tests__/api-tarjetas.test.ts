import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarCargo,
  actualizarTarjeta,
  crearCargo,
  crearTarjeta,
  eliminarCargo,
  eliminarTarjeta,
  listarCargos,
  listarTarjetas,
} from '@/lib/api/tarjetas';

// Contrato de /tarjetas y /tarjetas/:tarjetaId/cargos (criterios/05-tarjetas-pantallas.md,
// CA-RF24-F52 a F56 y CA-RF29-F42 a F46)
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

describe('adaptador de tarjetas y cargos fijos (/tarjetas)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
  const TARJETA_ID = '66a0b3c4d5e6f70012ab34cd';
  const CARGO_ID = '66a1b3c4d5e6f70012ab34ce';
  const tarjeta = {
    id: TARJETA_ID,
    nombre: 'Visa Bancolombia',
    tasaEA: 0.2921,
    cuotaUnicaSinInteres: true,
    creadaEn: '2026-09-17T15:00:00.000Z',
    actualizadaEn: '2026-09-17T15:00:00.000Z',
  };
  const cargo = {
    id: CARGO_ID,
    tarjetaId: TARJETA_ID,
    descripcion: 'Netflix',
    valor: 45000,
    activo: true,
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

  describe('listarTarjetas', () => {
    it('CA-RF24-F52 pide GET /tarjetas con el JWT y sin cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [tarjeta] }));

      await listarTarjetas();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(/\/tarjetas$/);
      expect(direccion.search).toBe('');
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF24-F52 entrega las tarjetas tal cual, sin redondear ni reordenar', async () => {
      const otra = { ...tarjeta, id: 'otra', nombre: 'Amex', tasaEA: 0.29213 };
      const items = [otra, tarjeta];
      fetchMock.mockResolvedValue(respuesta(200, { items }));

      await expect(listarTarjetas()).resolves.toEqual(items);
    });

    it('CA-RF24-F52 si no hay tarjetas ({ items: [] }) entrega []', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await expect(listarTarjetas()).resolves.toEqual([]);
    });
  });

  describe('crearTarjeta', () => {
    const datos = { nombre: 'Visa Bancolombia', tasaEA: 0.2921, cuotaUnicaSinInteres: true };

    it('CA-RF24-F53 envía POST /tarjetas con el JWT, la clave en el header y solo nombre, tasaEA y cuotaUnicaSinInteres en el cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, tarjeta));

      await expect(crearTarjeta(datos, clave)).resolves.toEqual(tarjeta);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(/\/tarjetas$/);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datos);
      expect(Object.keys(JSON.parse(init.body)).sort()).toEqual([
        'cuotaUnicaSinInteres',
        'nombre',
        'tasaEA',
      ]);
      expect(init.body).not.toContain(clave);
    });

    it('CA-RF24-F53 la tasa viaja como número y el interruptor apagado como false', async () => {
      fetchMock.mockResolvedValue(respuesta(201, tarjeta));

      await crearTarjeta({ nombre: 'Amex', tasaEA: 0, cuotaUnicaSinInteres: false }, clave);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo).toEqual({ nombre: 'Amex', tasaEA: 0, cuotaUnicaSinInteres: false });
      expect(typeof cuerpo.tasaEA).toBe('number');
    });

    it('CA-RF24-F53 cada llamada lleva la clave que recibe: la misma en un reintento y otra en una acción nueva', async () => {
      fetchMock.mockResolvedValue(respuesta(201, tarjeta));
      const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';

      await crearTarjeta(datos, clave);
      await crearTarjeta(datos, clave);
      await crearTarjeta(datos, otraClave);

      const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
      expect(claves).toEqual([clave, clave, otraClave]);
    });
  });

  describe('actualizarTarjeta', () => {
    it('CA-RF24-F54 envía PATCH /tarjetas/:id con el JWT, sin clave y solo los campos recibidos', async () => {
      const actualizada = { ...tarjeta, tasaEA: 0.315 };
      fetchMock.mockResolvedValue(respuesta(200, actualizada));

      await expect(actualizarTarjeta(TARJETA_ID, { tasaEA: 0.315 })).resolves.toEqual(actualizada);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}$`));
      expect(init.method).toBe('PATCH');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(JSON.parse(init.body)).toEqual({ tasaEA: 0.315 });
    });

    it('CA-RF24-F54 con varios campos los envía todos y con uno solo, nada más', async () => {
      fetchMock.mockResolvedValue(respuesta(200, tarjeta));

      await actualizarTarjeta(TARJETA_ID, { nombre: 'Visa Oro', cuotaUnicaSinInteres: false });
      await actualizarTarjeta(TARJETA_ID, { nombre: 'Visa Oro' });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        nombre: 'Visa Oro',
        cuotaUnicaSinInteres: false,
      });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ nombre: 'Visa Oro' });
    });
  });

  describe('eliminarTarjeta', () => {
    it('CA-RF24-F55 envía DELETE /tarjetas/:id con el JWT, sin cuerpo y sin clave, y termina con el 204 sin entregar nada', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      await expect(eliminarTarjeta(TARJETA_ID)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}$`));
      expect(init.method).toBe('DELETE');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });
  });

  describe('listarCargos', () => {
    it('CA-RF29-F42 pide GET /tarjetas/:tarjetaId/cargos sin query, con el JWT y sin cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [cargo] }));

      await listarCargos(TARJETA_ID);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/cargos$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF29-F42 entrega los cargos tal cual, sin redondear ni reordenar', async () => {
      const items = [
        { ...cargo, id: 'c2', descripcion: 'Spotify', valor: 25000.5 },
        { ...cargo, id: 'c3', descripcion: 'Gimnasio', valor: 90000, activo: false },
        cargo,
      ];
      fetchMock.mockResolvedValue(respuesta(200, { items }));

      await expect(listarCargos(TARJETA_ID)).resolves.toEqual(items);
    });

    it('CA-RF29-F42 si no hay cargos ({ items: [] }) entrega []', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await expect(listarCargos(TARJETA_ID)).resolves.toEqual([]);
    });

    it('CA-RF29-F42 usa el id de la tarjeta que recibe', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await listarCargos('otra-tarjeta');

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        /\/tarjetas\/otra-tarjeta\/cargos$/,
      );
    });
  });

  describe('crearCargo', () => {
    const datos = { descripcion: 'Netflix', valor: 45000, activo: true };

    it('CA-RF29-F43 envía POST /tarjetas/:tarjetaId/cargos con el JWT, la clave en el header y solo descripcion, valor y activo en el cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, cargo));

      await expect(crearCargo(TARJETA_ID, datos, clave)).resolves.toEqual(cargo);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/cargos$`));
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datos);
      expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['activo', 'descripcion', 'valor']);
      expect(init.body).not.toContain(clave);
      expect(init.body).not.toContain(TARJETA_ID);
    });

    it('CA-RF29-F43 el valor viaja como número y "activo" apagado como false', async () => {
      fetchMock.mockResolvedValue(respuesta(201, cargo));

      await crearCargo(TARJETA_ID, { descripcion: 'Gimnasio', valor: 90000, activo: false }, clave);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo).toEqual({ descripcion: 'Gimnasio', valor: 90000, activo: false });
      expect(typeof cuerpo.valor).toBe('number');
    });

    it('CA-RF29-F43 cada llamada lleva la clave que recibe: la misma en un reintento y otra en una acción nueva', async () => {
      fetchMock.mockResolvedValue(respuesta(201, cargo));
      const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';

      await crearCargo(TARJETA_ID, datos, clave);
      await crearCargo(TARJETA_ID, datos, clave);
      await crearCargo(TARJETA_ID, datos, otraClave);

      const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
      expect(claves).toEqual([clave, clave, otraClave]);
    });
  });

  describe('actualizarCargo', () => {
    it('CA-RF29-F44 envía PATCH /tarjetas/:tarjetaId/cargos/:id con el JWT, sin clave y solo los campos recibidos', async () => {
      const actualizado = { ...cargo, activo: false };
      fetchMock.mockResolvedValue(respuesta(200, actualizado));

      await expect(actualizarCargo(TARJETA_ID, CARGO_ID, { activo: false })).resolves.toEqual(
        actualizado,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(
        new RegExp(`/tarjetas/${TARJETA_ID}/cargos/${CARGO_ID}$`),
      );
      expect(init.method).toBe('PATCH');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(JSON.parse(init.body)).toEqual({ activo: false });
    });

    it('CA-RF29-F44 con varios campos los envía todos', async () => {
      fetchMock.mockResolvedValue(respuesta(200, cargo));

      await actualizarCargo(TARJETA_ID, CARGO_ID, { descripcion: 'Netflix HD', valor: 49900 });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        descripcion: 'Netflix HD',
        valor: 49900,
      });
    });
  });

  describe('eliminarCargo', () => {
    it('CA-RF29-F45 envía DELETE /tarjetas/:tarjetaId/cargos/:id con el JWT, sin cuerpo y sin clave, y termina con el 204 sin entregar nada', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      await expect(eliminarCargo(TARJETA_ID, CARGO_ID)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(new URL(url).pathname).toMatch(
        new RegExp(`/tarjetas/${TARJETA_ID}/cargos/${CARGO_ID}$`),
      );
      expect(init.method).toBe('DELETE');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });
  });

  // Los errores: los dos criterios (F56 para tarjetas y F46 para cargos) piden lo mismo de sus cuatro funciones
  type Llamada = [string, () => Promise<unknown>];
  function erroresDeLasCuatro(id: string, mensaje404: string, lista: Llamada[]) {
    it.each(lista)(
      id + ' %s: une los mensajes del 400 y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(400, { message: ['nombre debe ser un texto', 'tasaEA debe ser un número'] }),
        );

        await expect(llamar()).rejects.toMatchObject({
          status: 400,
          message: 'nombre debe ser un texto, tasaEA debe ser un número',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      id + ' %s: el 404 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(404, { message: mensaje404 }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 404, message: mensaje404 });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      id + ' %s: el 409 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(409, { message: 'Ya existe una tarjeta con ese nombre' }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 409,
          message: 'Ya existe una tarjeta con ese nombre',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(
      lista.flatMap(([nombre, llamar]) => [422, 500].map((s) => [nombre, s, llamar] as const)),
    )(
      id + ' %s: un %s llega como ApiError con su código y no cierra la sesión',
      async (_nombre, status, llamar) => {
        fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(id + ' %s: ante un 401 cierra la sesión', async (_nombre, llamar) => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(llamar()).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });

    it.each(lista)(
      id + ' %s: sin respuesta del servidor llega un NetworkError',
      async (_nombre, llamar) => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );
  }

  describe('errores del backend: tarjetas', () => {
    erroresDeLasCuatro('CA-RF24-F56', 'Tarjeta no encontrada', [
      ['listarTarjetas', () => listarTarjetas()],
      [
        'crearTarjeta',
        () => crearTarjeta({ nombre: 'Amex', tasaEA: 0.24, cuotaUnicaSinInteres: false }, clave),
      ],
      ['actualizarTarjeta', () => actualizarTarjeta(TARJETA_ID, { tasaEA: 0.3 })],
      ['eliminarTarjeta', () => eliminarTarjeta(TARJETA_ID)],
    ]);
  });

  describe('errores del backend: cargos fijos', () => {
    erroresDeLasCuatro('CA-RF29-F46', 'Cargo fijo no encontrado', [
      ['listarCargos', () => listarCargos(TARJETA_ID)],
      [
        'crearCargo',
        () => crearCargo(TARJETA_ID, { descripcion: 'Netflix', valor: 1, activo: true }, clave),
      ],
      ['actualizarCargo', () => actualizarCargo(TARJETA_ID, CARGO_ID, { valor: 1 })],
      ['eliminarCargo', () => eliminarCargo(TARJETA_ID, CARGO_ID)],
    ]);
  });
});
