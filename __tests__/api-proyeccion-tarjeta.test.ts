import { registrarManejadorDeSesion } from '@/lib/api/autenticado';
import { ApiError, NetworkError } from '@/lib/api/client';
import { listarTarjetas, obtenerProyeccion, obtenerTarjeta } from '@/lib/api/tarjetas';

// Contrato de GET /tarjetas/:tarjetaId/proyeccion?mes=YYYY-MM y de GET /tarjetas/:id
// (criterios/05-detalle-de-tarjeta.md, CA-RF30-F34 a F37). El backend se simula con `fetch`.
function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

describe('adaptador de la proyección y de una tarjeta (/tarjetas/:id…)', () => {
  const fetchMock = jest.fn();
  const alRechazarSesion = jest.fn();
  const TARJETA_ID = '66a0b3c4d5e6f70012ab34cd';
  const OTRA_TARJETA_ID = '66a0b3c4d5e6f70012ab34ce';
  const tarjeta = {
    id: TARJETA_ID,
    nombre: 'Visa Bancolombia',
    tasaEA: 0.2921,
    cuotaUnicaSinInteres: true,
    creadaEn: '2026-09-17T15:00:00.000Z',
    actualizadaEn: '2026-09-18T10:30:00.000Z',
  };
  // CON_CUOTAS del criterio: los montos llegan sin redondear
  const conCuotas = {
    tarjetaId: TARJETA_ID,
    mes: '2026-11',
    cuotas: 291270.05016469,
    cargosFijos: 55000,
    total: 346270.05016469,
    saldoPendiente: 1766528.890201,
    proyeccion: [
      {
        mes: '2026-12',
        cuotas: 209543.21823395,
        cargosFijos: 55000,
        total: 264543.21823395,
        saldoPendiente: 239604.26634376,
      },
      {
        mes: '2027-01',
        cuotas: 119802.13317188,
        cargosFijos: 55000,
        total: 174802.13317188,
        saldoPendiente: 119802.13317188,
      },
      {
        mes: '2027-02',
        cuotas: 119802.13317188,
        cargosFijos: 55000,
        total: 174802.13317188,
        saldoPendiente: 0,
      },
    ],
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

  describe('obtenerProyeccion', () => {
    it('CA-RF30-F34 pide GET /tarjetas/:tarjetaId/proyeccion?mes= con el JWT, sin cuerpo, sin clave y sin otros parámetros', async () => {
      fetchMock.mockResolvedValue(respuesta(200, conCuotas));

      await obtenerProyeccion(TARJETA_ID, '2026-12');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}/proyeccion$`));
      expect(direccion.search).toBe('?mes=2026-12');
      expect([...direccion.searchParams.keys()]).toEqual(['mes']);
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF30-F34 el mes y la tarjeta van tal cual, sin cambiarlos', async () => {
      fetchMock.mockResolvedValue(respuesta(200, conCuotas));

      await obtenerProyeccion(OTRA_TARJETA_ID, '2027-01');

      const direccion = new URL(fetchMock.mock.calls[0][0]);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${OTRA_TARJETA_ID}/proyeccion$`));
      expect(direccion.search).toBe('?mes=2027-01');
    });

    it('CA-RF30-F34 no agrega cabeceras por su cuenta: solo viajan las que ya envía el cliente compartido', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { items: [tarjeta] }));
      await listarTarjetas();
      fetchMock.mockResolvedValue(respuesta(200, conCuotas));

      await obtenerProyeccion(TARJETA_ID, '2026-11');

      const [, referencia] = fetchMock.mock.calls[0];
      const [, init] = fetchMock.mock.calls[1];
      expect(Object.keys(init.headers).sort()).toEqual(Object.keys(referencia.headers).sort());
      expect(init.headers['X-Zona-Horaria']).toBe(referencia.headers['X-Zona-Horaria']);
    });

    it('CA-RF30-F35 entrega la respuesta tal cual, con los decimales intactos y los meses en el orden recibido', async () => {
      fetchMock.mockResolvedValue(respuesta(200, conCuotas));

      const entregada = await obtenerProyeccion(TARJETA_ID, '2026-11');

      expect(entregada).toEqual(conCuotas);
      expect(entregada.cuotas).toBe(291270.05016469);
      expect(entregada.total).toBe(346270.05016469);
      expect(entregada.saldoPendiente).toBe(1766528.890201);
      expect(entregada.proyeccion.map((m) => m.mes)).toEqual(['2026-12', '2027-01', '2027-02']);
      expect(entregada.proyeccion[0]).toEqual({
        mes: '2026-12',
        cuotas: 209543.21823395,
        cargosFijos: 55000,
        total: 264543.21823395,
        saldoPendiente: 239604.26634376,
      });
    });

    it('CA-RF30-F35 con proyeccion [] entrega [] y no agrega, quita ni recalcula campos', async () => {
      const vacia = {
        tarjetaId: TARJETA_ID,
        mes: '2026-11',
        cuotas: 0,
        cargosFijos: 55000,
        total: 55000,
        saldoPendiente: 0,
        proyeccion: [],
      };
      fetchMock.mockResolvedValue(respuesta(200, vacia));

      const entregada = await obtenerProyeccion(TARJETA_ID, '2026-11');

      expect(entregada).toEqual(vacia);
      expect(Object.keys(entregada).sort()).toEqual(Object.keys(vacia).sort());
      expect(entregada.proyeccion).toEqual([]);
    });
  });

  describe('obtenerTarjeta', () => {
    it('CA-RF30-F36 pide GET /tarjetas/:id con el JWT, sin cuerpo, sin clave y sin parámetros', async () => {
      fetchMock.mockResolvedValue(respuesta(200, tarjeta));

      await obtenerTarjeta(TARJETA_ID);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      const direccion = new URL(url);
      expect(direccion.pathname).toMatch(new RegExp(`/tarjetas/${TARJETA_ID}$`));
      expect(direccion.search).toBe('');
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer jwt-vigente');
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
      expect(init.body).toBeUndefined();
    });

    it('CA-RF30-F36 el id va tal cual en la ruta', async () => {
      fetchMock.mockResolvedValue(respuesta(200, { ...tarjeta, id: OTRA_TARJETA_ID }));

      await obtenerTarjeta(OTRA_TARJETA_ID);

      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toMatch(
        new RegExp(`/tarjetas/${OTRA_TARJETA_ID}$`),
      );
    });

    it('CA-RF30-F36 entrega la tarjeta tal cual, con la tasa como fracción y sin cambiar nada', async () => {
      const conTasaLarga = { ...tarjeta, tasaEA: 0.29213, cuotaUnicaSinInteres: false };
      fetchMock.mockResolvedValue(respuesta(200, conTasaLarga));

      const entregada = await obtenerTarjeta(TARJETA_ID);

      expect(entregada).toEqual(conTasaLarga);
      expect(entregada.tasaEA).toBe(0.29213);
    });
  });

  // Las dos funciones explican los errores igual (CA-RF30-F37)
  type Llamada = [string, () => Promise<unknown>];
  const lista: Llamada[] = [
    ['obtenerProyeccion', () => obtenerProyeccion(TARJETA_ID, '2026-11')],
    ['obtenerTarjeta', () => obtenerTarjeta(TARJETA_ID)],
  ];

  describe('errores del backend', () => {
    it.each(lista)(
      'CA-RF30-F37 %s: une los mensajes del 400 y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(
          respuesta(400, { message: ['mes debe tener formato YYYY-MM', 'parámetro no permitido'] }),
        );

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({
          status: 400,
          message: 'mes debe tener formato YYYY-MM, parámetro no permitido',
        });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)(
      'CA-RF30-F37 %s: el 404 llega como ApiError con el mensaje del backend y no cierra la sesión',
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

    it.each(lista)(
      'CA-RF30-F37 %s: un 500 llega como ApiError con su código y no cierra la sesión',
      async (_nombre, llamar) => {
        fetchMock.mockResolvedValue(respuesta(500, { message: 'Internal server error' }));

        const falla = llamar();

        await expect(falla).rejects.toBeInstanceOf(ApiError);
        await expect(falla).rejects.toMatchObject({ status: 500 });
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );

    it.each(lista)('CA-RF30-F37 %s: ante un 401 cierra la sesión', async (_nombre, llamar) => {
      fetchMock.mockResolvedValue(respuesta(401, { message: 'Sesión inválida o vencida' }));

      await expect(llamar()).rejects.toMatchObject({ status: 401 });
      expect(alRechazarSesion).toHaveBeenCalledTimes(1);
    });

    it.each(lista)(
      'CA-RF30-F37 %s: sin respuesta del servidor llega un NetworkError',
      async (_nombre, llamar) => {
        fetchMock.mockRejectedValue(new TypeError('Network request failed'));

        await expect(llamar()).rejects.toBeInstanceOf(NetworkError);
        expect(alRechazarSesion).not.toHaveBeenCalled();
      },
    );
  });
});
