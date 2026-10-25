import Layout from '@/app/_layout';
import Home from '@/app/index';
import Login from '@/app/login';
import Perfil from '@/app/perfil';
import Registrar from '@/app/registrar';
import { fechaLarga, hoy } from '@/lib/fechas';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Registro paso a paso (paquete 2.2.4) con el router, la sesión y los Adapters reales.
// Se simulan solo los bordes del sistema: Firebase/Google, el backend (fetch) y el almacenamiento.
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

function respuesta(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', json: async () => body };
}

type Init = { method: string; body?: string; headers: Record<string, string> };

/** Backend simulado: categorías por tipo y creación de transacciones según cada prueba. */
function backend(alCrear: (cuerpo: Record<string, unknown>) => unknown = () => respuesta(201, {})) {
  fetchMock.mockImplementation(async (url: string, init: Init) => {
    if (url.includes('/categorias?tipo=EGRESO')) return respuesta(200, { items: [alimentacion] });
    if (url.includes('/categorias?tipo=INGRESO')) return respuesta(200, { items: [otrosIngresos] });
    if (url.endsWith('/transacciones') && init.method === 'POST') {
      return alCrear(JSON.parse(init.body as string));
    }
    return respuesta(404, { message: 'no simulado' });
  });
}

function creaciones() {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url.endsWith('/transacciones') && init.method === 'POST',
  );
}

async function abrirHome() {
  mockAlmacen.set(
    'sesion',
    JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
  );
  await renderRouter(rutas, { initialUrl: '/' });
}

async function escribirMonto(monto: string) {
  await fireEvent.changeText(await screen.findByLabelText('Monto en pesos'), monto);
  await fireEvent.press(screen.getByText('Siguiente'));
}

/** Recorre los pasos 1 a 4 de un egreso hasta quedar en el resumen. */
async function llegarAlResumenDeEgreso() {
  await abrirHome();
  await fireEvent.press(await screen.findByText('Registrar egreso'));
  await escribirMonto('45000');
  await fireEvent.press(await screen.findByLabelText('Alimentación'));
  await fireEvent.press(await screen.findByLabelText('Tarjeta débito'));
  await fireEvent.press(await screen.findByText('Siguiente'));
  await screen.findByText('Resumen');
}

describe('Registro paso a paso (integración)', () => {
  beforeEach(() => {
    mockAlmacen.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('egreso completo: recorre los cinco pasos, revisa el resumen y guarda con el contrato del backend', async () => {
    backend(() =>
      respuesta(201, {
        id: 't1',
        clasificacionFlujo: 'ORDINARIO',
        creadaEn: '2026-09-17T10:00:00Z',
      }),
    );
    await abrirHome();

    await fireEvent.press(await screen.findByText('Registrar egreso'));
    expect(await screen.findByText('Nuevo egreso')).toBeOnTheScreen();
    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    await escribirMonto('45000');

    expect(await screen.findByText('2 de 5')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByLabelText('Alimentación'));

    expect(await screen.findByText('3 de 5')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Tarjeta débito'));

    expect(await screen.findByText('4 de 5')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Siguiente'));

    expect(await screen.findByText('5 de 5')).toBeOnTheScreen();
    expect(screen.getByText('$ 45.000')).toBeOnTheScreen();
    expect(screen.getByText('Alimentación')).toBeOnTheScreen();
    expect(screen.getByText('Tarjeta débito')).toBeOnTheScreen();
    expect(screen.getByText('Hoy')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Nota'), '  almuerzo con el equipo ');
    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(
      screen.getByText(/Registramos tu egreso de \$ 45\.000 en Alimentación/),
    ).toBeOnTheScreen();

    expect(creaciones()).toHaveLength(1);
    const [, init] = creaciones()[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-guardado');
    expect(JSON.parse(init.body)).toEqual({
      tipo: 'EGRESO',
      monto: 45000,
      fecha: hoy(),
      categoriaId: 'c1',
      metodoPago: 'DEBITO',
      descripcion: 'almuerzo con el equipo',
    });

    await fireEvent.press(screen.getByText('Listo'));
    expect(await screen.findByText('Registrar egreso')).toBeOnTheScreen();
  });

  it('ingreso: el título, las categorías y el tipo enviado son de ingreso, sin tarjeta de crédito ni nota vacía', async () => {
    backend();
    await abrirHome();

    await fireEvent.press(await screen.findByText('Registrar ingreso'));
    expect(await screen.findByText('Nuevo ingreso')).toBeOnTheScreen();
    await escribirMonto('2500000');
    await fireEvent.press(await screen.findByLabelText('Otros ingresos'));

    expect(await screen.findByText('¿Cómo lo recibiste?')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Tarjeta crédito')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Transferencia'));
    await fireEvent.press(await screen.findByText('Siguiente'));
    await fireEvent.press(await screen.findByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(JSON.parse(creaciones()[0][1].body)).toEqual({
      tipo: 'INGRESO',
      monto: 2500000,
      fecha: hoy(),
      categoriaId: 'c9',
      metodoPago: 'TRANSFERENCIA',
    });
  });

  it('otra fecha: se elige en el calendario y se envía como YYYY-MM-DD', async () => {
    backend();
    await abrirHome();
    await fireEvent.press(await screen.findByText('Registrar egreso'));
    await escribirMonto('1000');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));
    await fireEvent.press(await screen.findByLabelText('Efectivo'));

    await fireEvent.press(await screen.findByText('Otra fecha'));
    const primero = `${hoy().slice(0, 8)}01`;
    await fireEvent.press(screen.getByLabelText(fechaLarga(primero)));
    await fireEvent.press(screen.getByText('Siguiente'));
    await fireEvent.press(await screen.findByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(JSON.parse(creaciones()[0][1].body).fecha).toBe(primero);
  });

  it('el monto en cero no deja avanzar y no se llama al backend', async () => {
    backend();
    await abrirHome();
    await fireEvent.press(await screen.findByText('Registrar egreso'));

    await fireEvent.press(await screen.findByText('Siguiente'));

    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('la tarjeta de crédito no avanza y no se envía al backend', async () => {
    backend();
    await abrirHome();
    await fireEvent.press(await screen.findByText('Registrar egreso'));
    await escribirMonto('5000');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));

    await fireEvent.press(await screen.findByLabelText('Tarjeta crédito'));

    expect(screen.getByText('3 de 5')).toBeOnTheScreen();
    expect(screen.getByText(/se podrán registrar muy pronto/)).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(0);
  });

  it('Atrás conserva lo que ya se escribió', async () => {
    backend();
    await abrirHome();
    await fireEvent.press(await screen.findByText('Registrar egreso'));
    await escribirMonto('45000');
    await fireEvent.press(await screen.findByLabelText('Alimentación'));
    await screen.findByText('3 de 5');

    await fireEvent.press(screen.getByText('Atrás'));
    await screen.findByText('2 de 5');
    await fireEvent.press(screen.getByText('Atrás'));

    expect(await screen.findByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto en pesos').props.value).toBe('$ 45.000');
  });

  it('cerrar con la ✕ vuelve al inicio sin guardar nada', async () => {
    backend();
    await abrirHome();
    await fireEvent.press(await screen.findByText('Registrar egreso'));
    await escribirMonto('45000');

    await fireEvent.press(await screen.findByLabelText('Cerrar'));

    expect(await screen.findByText('Registrar egreso')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(0);
  });

  it('si el backend rechaza el movimiento (400) avisa, conserva todo y permite reintentar', async () => {
    let intentos = 0;
    backend(() =>
      ++intentos === 1
        ? respuesta(400, { message: ['categoriaId debe ser un id de categoría válido'] })
        : respuesta(201, {}),
    );
    await llegarAlResumenDeEgreso();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText(/No pudimos guardar tu movimiento/)).toBeOnTheScreen();
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(screen.getByText('$ 45.000')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('¡Listo!')).toBeOnTheScreen();
    expect(creaciones()).toHaveLength(2);
  });

  it('si no hay conexión al guardar avisa con un mensaje de red', async () => {
    fetchMock.mockImplementation(async (url: string, init: Init) => {
      if (init.method === 'POST') throw new TypeError('Network request failed');
      return respuesta(200, { items: [alimentacion] });
    });
    await llegarAlResumenDeEgreso();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });

  it('si el backend responde 401 al guardar vuelve al login', async () => {
    backend(() =>
      respuesta(401, {
        statusCode: 401,
        message: 'Sesión inválida o vencida',
        error: 'Unauthorized',
      }),
    );
    await llegarAlResumenDeEgreso();

    await fireEvent.press(screen.getByText('Guardar'));

    expect(await screen.findByText('Continuar con Google')).toBeOnTheScreen();
    expect(mockAlmacen.has('sesion')).toBe(false);
  });

  it('sin un tipo válido en la dirección vuelve al inicio en lugar de adivinar', async () => {
    backend();
    mockAlmacen.set(
      'sesion',
      JSON.stringify({ accessToken: 'jwt-guardado', usuario, expiraEn: Date.now() + 60_000 }),
    );

    await renderRouter(rutas, { initialUrl: '/registrar?tipo=OTRO' });

    expect(await screen.findByText('Registrar egreso')).toBeOnTheScreen();
    expect(screen.queryByText('Nuevo egreso')).toBeNull();
  });
});
