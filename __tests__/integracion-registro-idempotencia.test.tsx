import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import Registrar from '@/app/registrar';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Clave de idempotencia del registro (criterios/02-registro-idempotencia.md) con el router, la sesión y los
// Adapters reales. Se simulan solo los bordes del sistema: Firebase/Google, el backend (fetch) y el almacenamiento.
const mockAlmacen = new Map<string, string>();

jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/firebase', () => ({
  auth: { signOut: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/google-sign-in', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/lib/session-storage', () => ({
  sessionStorage: {
    get: async () => mockAlmacen.get('sesion') ?? null,
    set: async (v: string) => void mockAlmacen.set('sesion', v),
    remove: async () => void mockAlmacen.delete('sesion'),
  },
}));

const usuario = { id: 'u1', nombre: 'Ana Prueba', email: 'ana@correo.com', fotoUrl: null };
const rutas = { _layout: Layout, index: Home, login: Login, perfil: Perfil, registrar: Registrar };
const fetchMock = jest.fn();

const alimentacion = {
  id: 'c1',
  nombre: 'Alimentación',
  tipo: 'EGRESO',
  esPredeterminada: true,
  movimientos: 0,
};

// Mismo formato que valida el backend para Idempotency-Key
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

type Init = { method: string; body?: string; headers: Record<string, string> };
type Resultado = ReturnType<typeof respuesta> | Promise<unknown>;

/** Backend simulado: categorías y, según el intento, lo que responde la creación de transacciones. */
function backend(alCrear: (intento: number) => Resultado | never = () => respuesta(201, {})) {
  let intento = 0;
  fetchMock.mockImplementation(async (url: string, init: Init) => {
    if (url.includes('/categorias')) return respuesta(200, { items: [alimentacion] });
    if (url.endsWith('/transacciones') && init.method === 'POST') return alCrear(++intento);
    return respuesta(404, { message: 'no simulado' });
  });
}

function creaciones() {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url.endsWith('/transacciones') && init.method === 'POST',
  );
}

const claveDe = (indice: number) => creaciones()[indice][1].headers['Idempotency-Key'];
const cuerpoDe = (indice: number) => JSON.parse(creaciones()[indice][1].body);

async function abrirHome() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
}

/** Desde el inicio, recorre los pasos 1 a 4 de un egreso de $45.000 hasta quedar en el resumen. */
async function recorrerEgreso(monto = '45000') {
  await fireEvent.press(await screen.findByText('Registrar egreso'));
  await fireEvent.changeText(await screen.findByLabelText('Monto en pesos'), monto);
  await fireEvent.press(screen.getByText('Siguiente'));
  await fireEvent.press(await screen.findByLabelText('Alimentación'));
  await fireEvent.press(await screen.findByLabelText('Tarjeta débito'));
  await fireEvent.press(await screen.findByText('Siguiente'));
  await screen.findByText('Resumen');
}

async function llegarAlResumen() {
  await abrirHome();
  await recorrerEgreso();
}

describe('Registro: clave de idempotencia (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('CA-RF06-16 la primera solicitud lleva una clave con formato de UUID', async () => {
    backend();
    await llegarAlResumen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(1);
    expect(claveDe(0)).toMatch(UUID);
  });

  it('CA-RF06-16 un registro nuevo con los mismos datos lleva una clave distinta', async () => {
    backend();
    await llegarAlResumen();
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText('¡Listo!');
    await fireEvent.press(screen.getByText('Listo'));

    await recorrerEgreso();
    await fireEvent.press(screen.getByText('Guardar'));

    await screen.findByText('¡Listo!');
    expect(creaciones()).toHaveLength(2);
    expect(cuerpoDe(1)).toEqual(cuerpoDe(0));
    expect(claveDe(1)).toMatch(UUID);
    expect(claveDe(1)).not.toBe(claveDe(0));
  });

  it('CA-RF06-17 tras un error del servidor, reintentar reutiliza la misma clave y los mismos datos', async () => {
    backend((intento) => (intento === 1 ? respuesta(500, { message: 'error' }) : respuesta(201, {})));
    await llegarAlResumen();

    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/No pudimos guardar tu movimiento/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toBe(claveDe(0));
    expect(cuerpoDe(1)).toEqual(cuerpoDe(0));
    expect(screen.queryByText(/No pudimos guardar tu movimiento/)).toBeNull();
  });

  it('CA-RF06-17 tras perder la conexión, reintentar reutiliza la misma clave', async () => {
    backend((intento) => {
      if (intento === 1) throw new TypeError('Network request failed');
      return respuesta(201, {});
    });
    await llegarAlResumen();

    await fireEvent.press(screen.getByText('Guardar'));
    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toBe(claveDe(0));
    expect(screen.queryByText(/No hay conexión con el servidor/)).toBeNull();
  });

  it('CA-RF06-18 si el backend repite la respuesta del primer intento, el usuario ve la confirmación normal', async () => {
    // El primer intento sí se guardó pero el usuario no recibió la respuesta; el reintento recibe la repetida
    backend((intento) => {
      if (intento === 1) throw new TypeError('Network request failed');
      return respuesta(201, { id: 't1', clasificacionFlujo: 'ORDINARIO', creadaEn: 'x' });
    });
    await llegarAlResumen();

    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/No hay conexión con el servidor/);
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(
      screen.getByText(/Registramos tu egreso de \$ 45\.000 en Alimentación/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toBe(claveDe(0));
  });

  it('CA-RF06-19 con un 409 avisa que todavía se está guardando y reintenta con la misma clave', async () => {
    backend((intento) =>
      intento === 1
        ? respuesta(409, {
            message: 'La petición ya se está procesando: espera su resultado antes de reintentar',
          })
        : respuesta(201, {}),
    );
    await llegarAlResumen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(
      await screen.findByText(
        'Tu movimiento todavía se está guardando. Espera unos segundos e inténtalo de nuevo.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/No pudimos guardar tu movimiento/)).toBeNull();
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toBe(claveDe(0));
  });

  it('CA-RF06-20 dos toques seguidos en Guardar envían una sola solicitud con una sola clave', async () => {
    let terminar!: (r: unknown) => void;
    backend(() => new Promise((resolver) => (terminar = resolver)));
    await llegarAlResumen();
    const guardar = screen.getByText('Guardar');

    await fireEvent.press(guardar);
    await fireEvent.press(guardar);

    expect(creaciones()).toHaveLength(1);
    expect(claveDe(0)).toMatch(UUID);
    terminar(respuesta(201, {}));
    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(1);
  });

  it('CA-RF06-21 volver a pasos anteriores sin cambiar nada y guardar de nuevo conserva la clave', async () => {
    backend((intento) => (intento === 1 ? respuesta(500, { message: 'error' }) : respuesta(201, {})));
    await llegarAlResumen();
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/No pudimos guardar tu movimiento/);

    await fireEvent.press(screen.getByText('Atrás'));
    await screen.findByText('4 de 5');
    await fireEvent.press(screen.getByText('Siguiente'));
    await screen.findByText('5 de 5');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toBe(claveDe(0));
    expect(cuerpoDe(1)).toEqual(cuerpoDe(0));
  });

  it('CA-RF06-22 si tras un fallo cambia el monto, la nueva solicitud lleva una clave distinta', async () => {
    backend((intento) => (intento === 1 ? respuesta(500, { message: 'error' }) : respuesta(201, {})));
    await llegarAlResumen();
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/No pudimos guardar tu movimiento/);

    for (const paso of ['4 de 5', '3 de 5', '2 de 5', '1 de 5']) {
      await fireEvent.press(screen.getByText('Atrás'));
      await screen.findByText(paso);
    }
    await fireEvent.changeText(screen.getByLabelText('Monto en pesos'), '50000');
    await fireEvent.press(screen.getByText('Siguiente'));
    await fireEvent.press(await screen.findByLabelText('Alimentación'));
    await fireEvent.press(await screen.findByLabelText('Tarjeta débito'));
    await fireEvent.press(await screen.findByText('Siguiente'));
    await screen.findByText('5 de 5');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(cuerpoDe(1).monto).toBe(50000);
    expect(claveDe(1)).toMatch(UUID);
    expect(claveDe(1)).not.toBe(claveDe(0));
  });

  it('CA-RF06-22 si tras un fallo cambia la nota, la nueva solicitud lleva una clave distinta', async () => {
    backend((intento) => (intento === 1 ? respuesta(500, { message: 'error' }) : respuesta(201, {})));
    await llegarAlResumen();
    await fireEvent.press(screen.getByText('Guardar'));
    await screen.findByText(/No pudimos guardar tu movimiento/);

    await fireEvent.changeText(screen.getByLabelText('Nota'), 'almuerzo con el equipo');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
    expect(cuerpoDe(1).descripcion).toBe('almuerzo con el equipo');
    expect(claveDe(0)).toMatch(UUID);
    expect(claveDe(1)).toMatch(UUID);
    expect(claveDe(1)).not.toBe(claveDe(0));
  });
});
