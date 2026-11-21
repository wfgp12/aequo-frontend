import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { eliminarPago, listarPagos, listarTarjetas, registrarPago } from '@/lib/api/tarjetas';

// Contrato de los pagos de una tarjeta: POST /tarjetas/:tarjetaId/pagos, GET /tarjetas/:tarjetaId/pagos[?mes=] y
// DELETE /tarjetas/:tarjetaId/pagos/:pagoId (criterios/05-pago-de-tarjeta.md, CA-RF32-F44 a F46 y F48).
// El backend se simula con `fetch`.
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

describe('adaptador de los pagos de una tarjeta (/tarjetas/:tarjetaId/pagos)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
  const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';
  const TARJETA_ID = '66a0b3c4d5e6f70012ab34cd';
  const OTRA_TARJETA_ID = '66a0b3c4d5e6f70012ab34ce';

  const datosPago = {
    valor: 100000,
    fecha: '2026-11-19',
    metodoPago: 'EFECTIVO' as const,
    descripcion: 'Cuota',
  };
  // Lo que responde el 201: el pago y la comparación del mes del pago, con los decimales sin redondear
  const pagoRegistrado = {
    id: 'pago-3',
    tarjetaId: TARJETA_ID,
    valor: 100000,
    fecha: '2026-11-19',
    metodoPago: 'EFECTIVO',
    descripcion: 'Cuota',
    creadaEn: '2026-11-19T17:00:00.000Z',
    comparacion: {
      mes: '2026-11',
      estimado: 346270.05016469,
      pagado: 100000,
      diferencia: -246270.05016469,
    },
  };
  // Lo que entrega GET …/pagos: cada pago sin `comparacion`, el más reciente primero
  const pagoReciente = {
    id: 'pago-3',
    tarjetaId: TARJETA_ID,
    valor: 100000,
    fecha: '2026-11-15',
    metodoPago: 'TRANSFERENCIA',
    descripcion: 'Pago de tarjeta',
    creadaEn: '2026-11-15T17:00:00.000Z',
  };
  const pagoAnterior = {
    id: 'pago-2',
    tarjetaId: TARJETA_ID,
    valor: 50000.5,
    fecha: '2026-11-10',
    metodoPago: 'EFECTIVO',
    descripcion: 'Abono de la quincena',
    creadaEn: '2026-11-10T17:00:00.000Z',
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

  describe('registrarPago', () => {
    it('CA-RF32-F44 envía POST /tarjetas/:tarjetaId/pagos con el JWT, la clave en el header y solo los cuatro campos en el cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      await registrarPago(TARJETA_ID, datosPago, clave);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/pagos$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datosPago);
      expect(Object.keys(JSON.parse(init.body)).sort()).toEqual([
        'descripcion',
        'fecha',
        'metodoPago',
        'valor',
      ]);
      expect(init.body).not.toContain(clave);
      expect(init.body).not.toContain(TARJETA_ID);
    });

    it('CA-RF32-F44 el valor viaja como número y la tarjeta es la que recibe', async () => {
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      await registrarPago(OTRA_TARJETA_ID, datosPago, clave);

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/pagos$`),
      );
      expect(typeof JSON.parse(fetchMock.mock.calls[0][1].body).valor).toBe('number');
    });

    it('CA-RF32-F44 no pone X-Zona-Horaria a mano: solo viajan las cabeceras del cliente compartido más las del pago', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));
      await listarTarjetas();
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      await registrarPago(TARJETA_ID, datosPago, clave);

      const [, referencia] = fetchMock.mock.calls[0];
      const [, init] = fetchMock.mock.calls[1];
      expect(init.headers['X-Zona-Horaria']).toBe(referencia.headers['X-Zona-Horaria']);
      const permitidas = [...Object.keys(referencia.headers), 'Content-Type', 'Idempotency-Key'];
      for (const cabecera of Object.keys(init.headers)) expect(permitidas).toContain(cabecera);
    });

    it('CA-RF32-F44 con solo el valor, el cuerpo lleva solo el valor: los demás campos no se envían ni como null', async () => {
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      await registrarPago(TARJETA_ID, { valor: 100000 }, clave);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo).toEqual({ valor: 100000 });
      expect(Object.keys(cuerpo)).toEqual(['valor']);
    });

    it('CA-RF32-F44 entrega el pago que responde el 201 tal cual, con su comparación y los decimales intactos', async () => {
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      const entregado = await registrarPago(TARJETA_ID, datosPago, clave);

      expect(entregado).toEqual(pagoRegistrado);
      expect(entregado.comparacion.estimado).toBe(346270.05016469);
      expect(entregado.comparacion.diferencia).toBe(-246270.05016469);
      expect(entregado.comparacion.mes).toBe('2026-11');
    });

    it('CA-RF32-F44 cada llamada lleva la clave que recibe: la misma en un reintento y otra en un pago nuevo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, pagoRegistrado));

      await registrarPago(TARJETA_ID, datosPago, clave);
      await registrarPago(TARJETA_ID, datosPago, clave);
      await registrarPago(TARJETA_ID, datosPago, otraClave);

      const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
      expect(claves).toEqual([clave, clave, otraClave]);
    });
  });

  describe('listarPagos', () => {
    it('CA-RF32-F45 pide GET /tarjetas/:tarjetaId/pagos?mes= con el JWT, sin cuerpo y sin clave', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [pagoReciente] }));

      await listarPagos(TARJETA_ID, '2026-11');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/pagos$`));
      expect(direccion.search).toBe('?mes=2026-11');
      expect([...direccion.searchParams.keys()]).toEqual(['mes']);
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF32-F45 sin mes pide GET /tarjetas/:tarjetaId/pagos sin parámetros', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [pagoReciente] }));

      await listarPagos(OTRA_TARJETA_ID);

      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/pagos$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF32-F45 entrega el arreglo de items con cada pago y el orden recibidos, sin comparación', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [pagoReciente, pagoAnterior] }));

      const entregados = await listarPagos(TARJETA_ID, '2026-11');

      expect(entregados).toEqual([pagoReciente, pagoAnterior]);
      expect(entregados.map((p) => p.id)).toEqual(['pago-3', 'pago-2']);
      expect(entregados[1].valor).toBe(50000.5);
      for (const pago of entregados) expect(pago).not.toHaveProperty('comparacion');
    });

    it('CA-RF32-F45 con { items: [] } entrega un arreglo vacío', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [] }));

      await expect(listarPagos(TARJETA_ID, '2026-11')).resolves.toEqual([]);
    });
  });

  describe('eliminarPago', () => {
    it('CA-RF32-F46 envía DELETE /tarjetas/:tarjetaId/pagos/:pagoId con el JWT, sin cuerpo y sin clave, y termina con el 204 sin entregar nada', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      await expect(eliminarPago(TARJETA_ID, 'pago-3')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/pagos/pago-3$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('DELETE');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF32-F46 la tarjeta y el pago van tal cual en la ruta', async () => {
      fetchMock.mockResolvedValue(sinCuerpo);

      await eliminarPago(OTRA_TARJETA_ID, 'pago-2');

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/pagos/pago-2$`),
      );
    });
  });

  // Las tres funciones explican los errores igual (CA-RF32-F48)
  type Llamada = [string, () => Promise<unknown>];
  const lista: Llamada[] = [
    ['registrarPago', () => registrarPago(TARJETA_ID, datosPago, clave)],
    ['listarPagos', () => listarPagos(TARJETA_ID, '2026-11')],
    ['eliminarPago', () => eliminarPago(TARJETA_ID, 'pago-3')],
  ];

  describe('errores del backend', () => {
    it.each(lista)(
      'CA-RF32-F48 %s: une los mensajes del 400 y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(400, { message: ['valor debe ser mayor que 0', 'parámetro no permitido'] }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 400,
          message: 'valor debe ser mayor que 0, parámetro no permitido',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['registrarPago', lista[0][1], 'Tarjeta no encontrada'],
      ['listarPagos', lista[1][1], 'Tarjeta no encontrada'],
      ['eliminarPago', lista[2][1], 'Pago no encontrado'],
    ] as [string, () => Promise<unknown>, string][])(
      'CA-RF32-F48 %s: el 404 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar, mensaje) => {
        fetchMock.mockResolvedValue(respuesta(404, { message: mensaje }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 404, message: mensaje });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF32-F48 %s: un 409 llega como ApiError con su código y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(409, { message: 'Solicitud en proceso' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 409 });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF32-F48 %s: un 422 llega como ApiError con su código y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(422, { message: 'Clave usada con otro cuerpo' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 422 });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF32-F48 %s: un 500 llega como ApiError con su código y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(500, { message: 'Internal server error' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 500 });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)('CA-RF32-F48 %s: ante un 401 cierra la sesión', async (_nombre, llamar) => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(llamar()).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });

    it.each(lista)(
      'CA-RF32-F48 %s: sin respuesta del servidor llega un NetworkError',
      async (_nombre, llamar) => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );
  });
});
