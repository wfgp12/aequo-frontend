import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerCuotaPrevia, registrarAvance, registrarCompra } from '@/lib/api/tarjetas';

// Contrato de las compras con tarjeta, los avances en efectivo y la vista previa de la cuota
// (criterios/05-compra-con-tarjeta.md, CA-RF26-F27 y F28, CA-RF27-F01 y F02, CA-RF28-F14).
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('adaptador de compras, avances y cuota previa (/tarjetas/:tarjetaId/…)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const clave = '0b9d3c1e-6a52-4f7e-9d8e-2c4f1a7b5e60';
  const otraClave = '5f2d8a40-1c7b-4e39-8b6a-9d0e3f1a2c47';
  const TARJETA_ID = '66a0b3c4d5e6f70012ab34cd';
  const OTRA_TARJETA_ID = '66a0b3c4d5e6f70012ab34ce';

  const datosCompra = {
    descripcion: 'Alimentación',
    categoriaId: 'cat-1',
    valor: 1254700,
    cuotas: 12,
    primerPago: '2026-12',
    fecha: '2026-11-19',
  };
  const datosAvance = { valor: 500000, cuotas: 6, primerPago: '2026-12', fecha: '2026-11-19' };
  const compra = {
    id: '66b0b3c4d5e6f70012ab34cd',
    tarjetaId: TARJETA_ID,
    categoriaId: 'cat-1',
    tipo: 'COMPRA',
    descripcion: 'Alimentación',
    valor: 1254700,
    cuotas: 12,
    fecha: '2026-11-19',
    primerPago: '2026-12',
    mesUltimoPago: '2027-11',
    tasaEAAplicada: 0.2921,
    cuotaUnicaSinInteres: false,
    cuota: 119802.1331718775,
    creadaEn: '2026-11-19T15:00:00.000Z',
    actualizadaEn: '2026-11-19T15:00:00.000Z',
  };
  const avance = {
    ...compra,
    id: '66b1b3c4d5e6f70012ab34cd',
    tipo: 'AVANCE',
    categoriaId: null,
    descripcion: 'Avance en efectivo',
    valor: 500000,
    cuotas: 6,
    mesUltimoPago: '2027-05',
    cuota: 89741.0851,
  };
  const cuotaPrevia = {
    cuota: 119802.1331718775,
    mesUltimoPago: '2027-11',
    tasaEAAplicada: 0.2921,
    cuotaUnicaSinInteres: false,
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

  describe('registrarCompra', () => {
    it('CA-RF26-F27 envía POST /tarjetas/:tarjetaId/compras con el JWT, la clave en el header y solo los seis campos en el cuerpo', async () => {
      fetchMock.mockResolvedValue(respuesta(201, compra));

      await registrarCompra(TARJETA_ID, datosCompra, clave);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/compras$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datosCompra);
      expect(Object.keys(JSON.parse(init.body)).sort()).toEqual([
        'categoriaId',
        'cuotas',
        'descripcion',
        'fecha',
        'primerPago',
        'valor',
      ]);
      expect(init.body).not.toContain(clave);
      expect(init.body).not.toContain(TARJETA_ID);
    });

    it('CA-RF26-F27 el valor y las cuotas viajan como números', async () => {
      fetchMock.mockResolvedValue(respuesta(201, compra));

      await registrarCompra(TARJETA_ID, datosCompra, clave);

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(typeof cuerpo.valor).toBe('number');
      expect(typeof cuerpo.cuotas).toBe('number');
    });

    it('CA-RF26-F27 entrega la compra que responde el 201 tal cual, con la cuota sin redondear', async () => {
      fetchMock.mockResolvedValue(respuesta(201, compra));

      await expect(registrarCompra(TARJETA_ID, datosCompra, clave)).resolves.toEqual(compra);
    });

    it('CA-RF26-F27 usa el id de la tarjeta que recibe', async () => {
      fetchMock.mockResolvedValue(respuesta(201, compra));

      await registrarCompra(OTRA_TARJETA_ID, datosCompra, clave);

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/compras$`),
      );
    });

    it('CA-RF26-F27 cada llamada lleva la clave que recibe: la misma en un reintento y otra en una compra nueva', async () => {
      fetchMock.mockResolvedValue(respuesta(201, compra));

      await registrarCompra(TARJETA_ID, datosCompra, clave);
      await registrarCompra(TARJETA_ID, datosCompra, clave);
      await registrarCompra(TARJETA_ID, datosCompra, otraClave);

      const claves = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
      expect(claves).toEqual([clave, clave, otraClave]);
    });
  });

  describe('registrarAvance', () => {
    it('CA-RF28-F14 envía POST /tarjetas/:tarjetaId/avances con el JWT, la clave y solo los campos recibidos (sin categoría ni descripción)', async () => {
      fetchMock.mockResolvedValue(respuesta(201, avance));

      await registrarAvance(TARJETA_ID, datosAvance, clave);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/avances$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Idempotency-Key']).toBe(clave);
      expect(JSON.parse(init.body)).toEqual(datosAvance);
      expect(Object.keys(JSON.parse(init.body)).sort()).toEqual([
        'cuotas',
        'fecha',
        'primerPago',
        'valor',
      ]);
      expect(init.body).not.toContain(clave);
    });

    it('CA-RF28-F14 con descripción la envía, y nada más', async () => {
      fetchMock.mockResolvedValue(respuesta(201, avance));

      await registrarAvance(
        TARJETA_ID,
        { ...datosAvance, descripcion: 'Arreglo del carro' },
        clave,
      );

      const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(cuerpo).toEqual({ ...datosAvance, descripcion: 'Arreglo del carro' });
      expect(cuerpo).not.toHaveProperty('categoriaId');
    });

    it('CA-RF28-F14 entrega la compra de tipo AVANCE que responde el 201 tal cual, con la cuota sin redondear', async () => {
      fetchMock.mockResolvedValue(respuesta(201, avance));

      const entregado = await registrarAvance(TARJETA_ID, datosAvance, clave);

      expect(entregado).toEqual(avance);
      expect(entregado.tipo).toBe('AVANCE');
      expect(entregado.cuota).toBe(89741.0851);
    });

    it('CA-RF28-F14 usa el id de la tarjeta que recibe y la clave que recibe', async () => {
      fetchMock.mockResolvedValue(respuesta(201, avance));

      await registrarAvance(OTRA_TARJETA_ID, datosAvance, clave);
      await registrarAvance(OTRA_TARJETA_ID, datosAvance, otraClave);

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/avances$`),
      );
      expect(fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key'])).toEqual([
        clave,
        otraClave,
      ]);
    });
  });

  describe('obtenerCuotaPrevia', () => {
    it('CA-RF27-F01 pide GET /tarjetas/:tarjetaId/cuota con valor, cuotas y primerPago en la consulta, el JWT, sin cuerpo y sin clave', async () => {
      fetchMock.mockResolvedValue(respuesta(200, cuotaPrevia));

      await obtenerCuotaPrevia(TARJETA_ID, { valor: 1254700, cuotas: 12, primerPago: '2026-12' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/cuota$`));
      expect(direccion.searchParams.get('valor')).toBe('1254700');
      expect(direccion.searchParams.get('cuotas')).toBe('12');
      expect(direccion.searchParams.get('primerPago')).toBe('2026-12');
      expect([...direccion.searchParams.keys()].sort()).toEqual(['cuotas', 'primerPago', 'valor']);
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF27-F01 la consulta lleva lo que recibe: otra tarjeta, una cuota y enero', async () => {
      fetchMock.mockResolvedValue(respuesta(200, cuotaPrevia));

      await obtenerCuotaPrevia(OTRA_TARJETA_ID, { valor: 80000, cuotas: 1, primerPago: '2027-01' });

      const direccion = new URL(fetchMock.mock.calls[0][0]);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/cuota$`));
      expect(direccion.searchParams.get('valor')).toBe('80000');
      expect(direccion.searchParams.get('cuotas')).toBe('1');
      expect(direccion.searchParams.get('primerPago')).toBe('2027-01');
    });

    it('CA-RF27-F01 entrega la respuesta tal como llegó: cuota sin redondear, mes del último pago y tasa como fracción', async () => {
      fetchMock.mockResolvedValue(respuesta(200, cuotaPrevia));

      const entregada = await obtenerCuotaPrevia(TARJETA_ID, {
        valor: 1254700,
        cuotas: 12,
        primerPago: '2026-12',
      });

      expect(entregada).toEqual({
        cuota: 119802.1331718775,
        mesUltimoPago: '2027-11',
        tasaEAAplicada: 0.2921,
        cuotaUnicaSinInteres: false,
      });
    });
  });

  // Los tres adaptadores explican los errores igual (CA-RF26-F28 y CA-RF27-F02)
  type Llamada = [string, () => Promise<unknown>];
  const lista: Llamada[] = [
    ['registrarCompra', () => registrarCompra(TARJETA_ID, datosCompra, clave)],
    ['registrarAvance', () => registrarAvance(TARJETA_ID, datosAvance, clave)],
    [
      'obtenerCuotaPrevia',
      () => obtenerCuotaPrevia(TARJETA_ID, { valor: 1254700, cuotas: 12, primerPago: '2026-12' }),
    ],
  ];

  describe('errores del backend', () => {
    it.each(lista)(
      'CA-RF26-F28 y CA-RF27-F02 %s: une los mensajes del 400 y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(400, { message: ['valor debe ser mayor que 0', 'cuotas debe ser un entero'] }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 400,
          message: 'valor debe ser mayor que 0, cuotas debe ser un entero',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF26-F28 y CA-RF27-F02 %s: el 404 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(404, { message: 'Tarjeta no encontrada' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 404,
          message: 'Tarjeta no encontrada',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista.slice(0, 2))(
      'CA-RF26-F28 %s: el 409 llega como ApiError con el mensaje del backend y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(409, { message: 'La solicitud con esa clave todavía se está procesando' }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 409,
          message: 'La solicitud con esa clave todavía se está procesando',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(
      lista.flatMap(([nombre, llamar]) => [422, 500].map((s) => [nombre, s, llamar] as const)),
    )(
      'CA-RF26-F28 y CA-RF27-F02 %s: un %s llega como ApiError con su código y no cierra la sesión',
      async (_nombre, status, llamar) => {
        fetchMock.mockResolvedValue(respuesta(status, { message: 'x' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF26-F28 y CA-RF27-F02 %s: ante un 401 cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

        await expect(llamar()).rejects.toMatchObject({ status: 401 });
        expect(alRechazarSesion).toHaveBeenCalledTimes(1);
      },
    );

    it.each(lista)(
      'CA-RF26-F28 y CA-RF27-F02 %s: sin respuesta del servidor llega un NetworkError',
      async (_nombre, llamar) => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );
  });
});
