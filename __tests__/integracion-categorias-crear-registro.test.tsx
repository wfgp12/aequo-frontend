import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import Registrar from '@/app/registrar';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Crear una categoría desde el paso 2 del registro (criterios/02-categorias-crear.md) con el router, la sesión y los
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
const otrosIngresos = {
  id: 'c9',
  nombre: 'Otros ingresos',
  tipo: 'INGRESO',
  esPredeterminada: true,
  movimientos: 0,
};
const mascotas = {
  id: 'c20',
  nombre: 'Mascotas',
  tipo: 'EGRESO',
  esPredeterminada: false,
  movimientos: 0,
};
const becas = { id: 'c21', nombre: 'Becas', tipo: 'INGRESO', esPredeterminada: false, movimientos: 0 };

// Mismo formato que valida el backend para Idempotency-Key
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

type Init = { method: string; body?: string; headers: Record<string, string> };

/** Backend simulado: categorías por tipo, creación de categorías y de transacciones. */
function backend(alCrearCategoria: (cuerpo: { tipo: string }) => unknown = (c) =>
  respuesta(201, c.tipo === 'INGRESO' ? becas : mascotas),
) {
  fetchMock.mockImplementation(async (url: string, init: Init) => {
    if (url.endsWith('/categorias') && init.method === 'POST') {
      return alCrearCategoria(JSON.parse(init.body as string));
    }
    if (url.includes('/categorias?tipo=EGRESO')) return respuesta(200, { items: [alimentacion] });
    if (url.includes('/categorias?tipo=INGRESO')) return respuesta(200, { items: [otrosIngresos] });
    if (url.endsWith('/transacciones') && init.method === 'POST') return respuesta(201, {});
    return respuesta(404, { message: 'no simulado' });
  });
}

const creacionesDeCategoria = () =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/categorias') && init.method === 'POST');
const listasPedidas = () => fetchMock.mock.calls.filter(([url]) => url.includes('/categorias?'));
const creacionesDeMovimiento = () =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/transacciones') && init.method === 'POST');

async function abrirHome() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
}

/** Desde el inicio llega al paso 2 ("¿En qué categoría?") con el valor ya escrito. */
async function irAlPasoDeCategoria(tipo: 'EGRESO' | 'INGRESO', monto = '45000') {
  await abrirHome();
  await fireEvent.press(await screen.findByText(`Registrar ${tipo === 'EGRESO' ? 'egreso' : 'ingreso'}`));
  await fireEvent.changeText(await screen.findByLabelText('Monto en pesos'), monto);
  await fireEvent.press(screen.getByText('Siguiente'));
  await screen.findByText('2 de 5');
}

async function crearDesdeElSelector(nombre: string) {
  await fireEvent.press(await screen.findByLabelText('Agregar categoría'));
  await screen.findByText('Nueva categoría');
  await fireEvent.changeText(screen.getByLabelText('Nombre'), nombre);
  await fireEvent.press(screen.getByText('Guardar'));
}

describe('Crear categoría desde el registro (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('CA-RF10-F01 el paso 2 de un egreso ofrece "+ Agregar categoría" junto a las categorías y a "Atrás"', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');

    expect(await screen.findByText('+ Agregar categoría')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alimentación')).toBeOnTheScreen();
    expect(screen.getByText('Atrás')).toBeOnTheScreen();
  });

  it('CA-RF10-F02 el paso 2 de un ingreso también ofrece "+ Agregar categoría"', async () => {
    backend();
    await irAlPasoDeCategoria('INGRESO');

    expect(await screen.findByText('+ Agregar categoría')).toBeOnTheScreen();
    expect(screen.getByLabelText('Otros ingresos')).toBeOnTheScreen();
  });

  it('CA-RF10-F05 en un egreso la hoja "Nueva categoría" muestra "Egreso", "Nombre" vacío y "Guardar"', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');

    await fireEvent.press(await screen.findByLabelText('Agregar categoría'));

    expect(await screen.findByText('Nueva categoría')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('');
    expect(screen.getByText('Guardar')).toBeOnTheScreen();
  });

  it('CA-RF10-F06 al registrar un egreso envía POST /categorias con tipo EGRESO', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('Mascotas');

    await screen.findByText('3 de 5');
    expect(creacionesDeCategoria()).toHaveLength(1);
    expect(JSON.parse(creacionesDeCategoria()[0][1].body)).toEqual({
      nombre: 'Mascotas',
      tipo: 'EGRESO',
    });
  });

  it('CA-RF10-F06 al registrar un ingreso envía POST /categorias con tipo INGRESO', async () => {
    backend();
    await irAlPasoDeCategoria('INGRESO');

    await crearDesdeElSelector('Becas');

    await screen.findByText('3 de 5');
    expect(JSON.parse(creacionesDeCategoria()[0][1].body)).toEqual({
      nombre: 'Becas',
      tipo: 'INGRESO',
    });
  });

  it('CA-RF10-F07 la solicitud lleva el JWT, el nombre sin espacios sobrantes y un Idempotency-Key con formato UUID', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('  Mascotas ');

    await screen.findByText('3 de 5');
    expect(creacionesDeCategoria()).toHaveLength(1);
    const [, init] = creacionesDeCategoria()[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
    expect(init.headers['Idempotency-Key']).toMatch(UUID);
    expect(JSON.parse(init.body)).toEqual({ nombre: 'Mascotas', tipo: 'EGRESO' });
  });

  it('CA-RF10-F08 cerrar la hoja con la ✕ no crea nada y deja el registro en el paso 2 sin perder lo capturado', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');
    await fireEvent.press(await screen.findByLabelText('Agregar categoría'));
    await screen.findByText('Nueva categoría');
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Mascotas');

    // Con la hoja abierta puede haber dos ✕ (la del registro y la de la hoja); la de la hoja es la última
    await fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);

    expect(await screen.findByLabelText('Alimentación')).toBeOnTheScreen();
    expect(screen.queryByText('Nueva categoría')).toBeNull();
    expect(screen.getByText('2 de 5')).toBeOnTheScreen();
    expect(creacionesDeCategoria()).toHaveLength(0);

    await fireEvent.press(screen.getByText('Atrás'));
    expect(await screen.findByLabelText('Monto en pesos')).toHaveDisplayValue('$ 45.000');
  });

  it('CA-RF10-F15 en un egreso la categoría nueva queda elegida: avanza al paso 3, aparece en el resumen y se guarda con ella', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('Mascotas');

    expect(await screen.findByText('3 de 5')).toBeOnTheScreen();
    expect(screen.queryByText('Nueva categoría')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('Efectivo'));
    await fireEvent.press(await screen.findByText('Siguiente'));
    await screen.findByText('Resumen');
    expect(screen.getByText('Mascotas')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(screen.getByText(/Registramos tu egreso de \$ 45\.000 en Mascotas/)).toBeOnTheScreen();
    expect(JSON.parse(creacionesDeMovimiento()[0][1].body)).toMatchObject({
      tipo: 'EGRESO',
      categoriaId: 'c20',
    });
  });

  it('CA-RF10-F15 en un ingreso la categoría nueva queda elegida y el flujo avanza al paso 3', async () => {
    backend();
    await irAlPasoDeCategoria('INGRESO');

    await crearDesdeElSelector('Becas');

    expect(await screen.findByText('3 de 5')).toBeOnTheScreen();
    expect(await screen.findByText('¿Cómo lo recibiste?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Transferencia'));
    await fireEvent.press(await screen.findByText('Siguiente'));
    await screen.findByText('Resumen');
    expect(screen.getByText('Becas')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(JSON.parse(creacionesDeMovimiento()[0][1].body)).toMatchObject({
      tipo: 'INGRESO',
      categoriaId: 'c21',
    });
  });

  it('CA-RF10-F15 no se vuelve a pedir la lista de categorías después de crear', async () => {
    backend();
    await irAlPasoDeCategoria('EGRESO');
    await screen.findByLabelText('Alimentación');
    expect(listasPedidas()).toHaveLength(1);

    await crearDesdeElSelector('Mascotas');

    await screen.findByText('3 de 5');
    expect(listasPedidas()).toHaveLength(1);
  });

  it('CA-RF10-F16 con un 409 avisa que el nombre está repetido, conserva el nombre y sigue en el paso 2', async () => {
    backend(() => respuesta(409, { message: 'Ya existe una categoría con ese nombre' }));
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('Alimentación');

    expect(
      await screen.findByText('Ya existe una categoría con ese nombre. Prueba con otro.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Alimentación');
    expect(screen.getByText('Nueva categoría')).toBeOnTheScreen();
    expect(screen.getByText('2 de 5')).toBeOnTheScreen();
    // El 409 no cierra la sesión
    expect(mockAlmacen.has('sesion')).toBe(true);
  });

  it('CA-RF10-F17 sin conexión avisa y al reintentar reutiliza la misma clave', async () => {
    let intento = 0;
    backend(() => {
      if (++intento === 1) throw new TypeError('Network request failed');
      return respuesta(201, mascotas);
    });
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('Mascotas');
    expect(
      await screen.findByText(
        'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('3 de 5')).toBeOnTheScreen();
    expect(creacionesDeCategoria()).toHaveLength(2);
    expect(creacionesDeCategoria()[0][1].headers['Idempotency-Key']).toMatch(UUID);
    expect(creacionesDeCategoria()[1][1].headers['Idempotency-Key']).toBe(
      creacionesDeCategoria()[0][1].headers['Idempotency-Key'],
    );
  });

  it('CA-RF10-F20 si el backend responde 401 al crear vuelve al login', async () => {
    backend(() =>
      respuesta(401, { statusCode: 401, message: 'Sesión inválida o vencida', error: 'Unauthorized' }),
    );
    await irAlPasoDeCategoria('EGRESO');

    await crearDesdeElSelector('Mascotas');

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });
});
