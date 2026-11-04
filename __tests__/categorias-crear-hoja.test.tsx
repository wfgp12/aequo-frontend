import { ListaDeCategorias } from '@/components/categorias/lista-de-categorias';
import { PasoCategoria } from '@/components/registro/paso-categoria';
import { crearCategoria, listarCategorias, type Categoria } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Crear una categoría desde el selector (criterios/02-categorias-crear.md): el botón "+ Agregar categoría" y la
// hoja "Nueva categoría" en ListaDeCategorias, con el backend simulado en el borde del adaptador.
jest.mock('@/lib/api/categorias', () => ({ listarCategorias: jest.fn(), crearCategoria: jest.fn() }));

const listar = jest.mocked(listarCategorias);
const crear = jest.mocked(crearCategoria);

const CATEGORIAS: Categoria[] = [
  { id: 'c1', nombre: 'Alimentación', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c2', nombre: 'Transporte', tipo: 'EGRESO', esPredeterminada: true, movimientos: 0 },
  { id: 'c3', nombre: 'Mascotas', tipo: 'EGRESO', esPredeterminada: false, movimientos: 12 },
];
const plantas: Categoria = {
  id: 'c20',
  nombre: 'Plantas',
  tipo: 'EGRESO',
  esPredeterminada: false,
  movimientos: 0,
};

// Mismo formato que valida el backend para Idempotency-Key
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TEXTO_VALIDACION_VACIO = 'Escribe un nombre para la categoría.';
const TEXTO_VALIDACION_LARGO = 'El nombre puede tener hasta 40 letras.';
const TEXTO_REPETIDO = 'Ya existe una categoría con ese nombre. Prueba con otro.';
const TEXTO_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const TEXTO_GENERAL = 'No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo.';

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

/** Todos los textos visibles, en el orden en que aparecen en pantalla. */
function textosEnOrden(nodo: unknown = screen.toJSON(), acumulado: string[] = []): string[] {
  if (typeof nodo === 'string') acumulado.push(nodo);
  else if (Array.isArray(nodo)) nodo.forEach((n) => textosEnOrden(n, acumulado));
  else if (nodo && typeof nodo === 'object' && 'children' in nodo) {
    textosEnOrden((nodo as { children: unknown }).children, acumulado);
  }
  return acumulado;
}

const botonAgregar = () => screen.getByLabelText('Agregar categoría');
const campoNombre = () => screen.getByLabelText('Nombre');
const guardar = () => screen.getByText('Guardar');
const hojaAbierta = () => screen.queryByText('Nueva categoría') !== null;

async function abrirLista(tipo: 'INGRESO' | 'EGRESO' = 'EGRESO') {
  const alElegir = jest.fn();
  await render(<ListaDeCategorias tipo={tipo} onElegir={alElegir} />);
  await screen.findByText('Alimentación');
  return alElegir;
}

async function abrirHoja(tipo: 'INGRESO' | 'EGRESO' = 'EGRESO') {
  const alElegir = await abrirLista(tipo);
  await fireEvent.press(botonAgregar());
  await screen.findByText('Nueva categoría');
  return alElegir;
}

async function escribirYGuardar(nombre: string) {
  await fireEvent.changeText(campoNombre(), nombre);
  await fireEvent.press(guardar());
}

const clavesUsadas = () => crear.mock.calls.map(([, clave]) => clave);

describe('Crear categoría desde el selector (hoja "Nueva categoría")', () => {
  beforeEach(() => {
    listar.mockReset().mockImplementation(async () => CATEGORIAS.map((c) => ({ ...c })));
    crear.mockReset().mockResolvedValue({ ...plantas });
  });

  describe('dónde está la opción de crear', () => {
    it('CA-RF10-F01 el paso de categoría de un egreso termina con "+ Agregar categoría" y debajo sigue "Atrás"', async () => {
      await render(<PasoCategoria tipo="EGRESO" onElegir={jest.fn()} onAtras={jest.fn()} />);
      await screen.findByText('Transporte');

      expect(screen.getByText('+ Agregar categoría')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Agregar categoría' })).toBeOnTheScreen();
      const orden = textosEnOrden();
      expect(orden.indexOf('Mascotas')).toBeLessThan(orden.indexOf('+ Agregar categoría'));
      expect(orden.indexOf('+ Agregar categoría')).toBeLessThan(orden.indexOf('Atrás'));
    });

    it('CA-RF10-F02 el paso de categoría de un ingreso también termina con "+ Agregar categoría"', async () => {
      await render(<PasoCategoria tipo="INGRESO" onElegir={jest.fn()} onAtras={jest.fn()} />);
      await screen.findByText('Transporte');

      expect(listar).toHaveBeenCalledWith('INGRESO');
      expect(screen.getByText('+ Agregar categoría')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Agregar categoría' })).toBeOnTheScreen();
    });

    it('CA-RF10-F04 mientras la lista carga no se ofrece crear, y aparece al terminar de cargar', async () => {
      const carga = pendiente<Categoria[]>();
      listar.mockReturnValueOnce(carga.promesa);
      await render(<ListaDeCategorias tipo="EGRESO" onElegir={jest.fn()} />);

      expect(screen.getByLabelText('Cargando categorías')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Agregar categoría')).toBeNull();

      await act(async () => carga.resolver([...CATEGORIAS]));

      expect(await screen.findByLabelText('Agregar categoría')).toBeOnTheScreen();
    });

    it('CA-RF10-F04 si la carga falló no se ofrece crear, y aparece al reintentar con éxito', async () => {
      listar.mockRejectedValueOnce(new NetworkError());
      await render(<ListaDeCategorias tipo="EGRESO" onElegir={jest.fn()} />);

      expect(await screen.findByText('Reintentar')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Agregar categoría')).toBeNull();

      await fireEvent.press(screen.getByText('Reintentar'));

      expect(await screen.findByLabelText('Agregar categoría')).toBeOnTheScreen();
    });

    it('CA-RF10-F25 el botón sigue visible cuando el buscador filtra la lista', async () => {
      await abrirLista();

      await fireEvent.changeText(screen.getByLabelText('Buscar categoría'), 'alimen');

      expect(screen.queryByText('Transporte')).toBeNull();
      expect(screen.getByLabelText('Agregar categoría')).toBeOnTheScreen();
    });

    it('CA-RF10-F25 el botón sigue visible cuando el buscador no encuentra nada', async () => {
      await abrirLista();

      await fireEvent.changeText(screen.getByLabelText('Buscar categoría'), 'zzz');

      expect(screen.getByText('No encontramos categorías con ese nombre.')).toBeOnTheScreen();
      expect(screen.getByLabelText('Agregar categoría')).toBeOnTheScreen();
    });
  });

  describe('la hoja', () => {
    it('CA-RF10-F05 tocar el botón abre la hoja "Nueva categoría" con el tipo Egreso fijo, "Nombre" vacío y "Guardar"', async () => {
      await abrirLista();

      await fireEvent.press(botonAgregar());

      expect(await screen.findByText('Nueva categoría')).toBeOnTheScreen();
      expect(screen.getByText('Egreso')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Egreso' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Ingreso' })).toBeNull();
      expect(campoNombre()).toHaveDisplayValue('');
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeOnTheScreen();
    });

    it('CA-RF10-F05 en un ingreso la hoja muestra el tipo Ingreso', async () => {
      await abrirHoja('INGRESO');

      expect(screen.getByText('Ingreso')).toBeOnTheScreen();
      expect(screen.queryByText('Egreso')).toBeNull();
    });

    it('CA-RF10-F26 el campo "Nombre" arranca vacío aunque el usuario ya haya escrito en el buscador', async () => {
      await abrirLista();
      await fireEvent.changeText(screen.getByLabelText('Buscar categoría'), 'zzz');

      await fireEvent.press(botonAgregar());

      await screen.findByText('Nueva categoría');
      expect(campoNombre()).toHaveDisplayValue('');
    });

    it('CA-RF10-F06 en el selector de un egreso crea la categoría con tipo EGRESO', async () => {
      await abrirHoja('EGRESO');

      await escribirYGuardar('Plantas');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Plantas', tipo: 'EGRESO' });
    });

    it('CA-RF10-F06 en el selector de un ingreso crea la categoría con tipo INGRESO', async () => {
      await abrirHoja('INGRESO');

      await escribirYGuardar('Becas');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Becas', tipo: 'INGRESO' });
    });

    it('CA-RF10-F07 "Guardar" envía una sola solicitud con el nombre sin espacios sobrantes, el tipo y una clave UUID', async () => {
      await abrirHoja();

      await escribirYGuardar('  Plantas ');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear).toHaveBeenCalledWith({ nombre: 'Plantas', tipo: 'EGRESO' }, expect.any(String));
      expect(Object.keys(crear.mock.calls[0][0]).sort()).toEqual(['nombre', 'tipo']);
      expect(crear.mock.calls[0][1]).toMatch(UUID);
    });

    it('CA-RF10-F08 la ✕ cierra la hoja sin enviar nada, aunque haya texto escrito, y sin pedir confirmación', async () => {
      const alElegir = await abrirHoja();
      await fireEvent.changeText(campoNombre(), 'Plantas');

      await fireEvent.press(screen.getByLabelText('Cerrar'));

      await waitFor(() => expect(hojaAbierta()).toBe(false));
      expect(crear).not.toHaveBeenCalled();
      expect(alElegir).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.queryByText('Cancelar')).toBeNull();
      expect(screen.getByText('Alimentación')).toBeOnTheScreen();
      expect(screen.getByLabelText('Agregar categoría')).toBeOnTheScreen();
    });

    it('CA-RF10-F08 la hoja no tiene botón "Cancelar": solo la ✕', async () => {
      await abrirHoja();

      expect(screen.queryByText('Cancelar')).toBeNull();
      expect(screen.getByLabelText('Cerrar')).toBeOnTheScreen();
    });
  });

  describe('validación del nombre antes de llamar al backend', () => {
    it.each([['vacío', ''], ['solo con espacios', '    ']])(
      'CA-RF10-F09 un nombre %s no se envía y avisa',
      async (_caso, nombre) => {
        await abrirHoja();

        await escribirYGuardar(nombre);

        expect(await screen.findByText(TEXTO_VALIDACION_VACIO)).toBeOnTheScreen();
        expect(hojaAbierta()).toBe(true);
        expect(crear).not.toHaveBeenCalled();
      },
    );

    it('CA-RF10-F10 un nombre de 41 caracteres no se envía y avisa', async () => {
      await abrirHoja();

      await escribirYGuardar('a'.repeat(41));

      expect(await screen.findByText(TEXTO_VALIDACION_LARGO)).toBeOnTheScreen();
      expect(hojaAbierta()).toBe(true);
      expect(crear).not.toHaveBeenCalled();
    });

    it('CA-RF10-F10 los espacios de los extremos no cuentan: 40 caracteres con espacios se envían', async () => {
      await abrirHoja();

      await escribirYGuardar(`  ${'a'.repeat(40)}  `);

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear.mock.calls[0][0]).toEqual({ nombre: 'a'.repeat(40), tipo: 'EGRESO' });
      expect(screen.queryByText(TEXTO_VALIDACION_LARGO)).toBeNull();
    });

    it('CA-RF10-F10 un nombre de un solo carácter es válido', async () => {
      await abrirHoja();

      await escribirYGuardar('a');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear.mock.calls[0][0]).toEqual({ nombre: 'a', tipo: 'EGRESO' });
    });

    it.each([
      ['vacío', '', TEXTO_VALIDACION_VACIO],
      ['demasiado largo', 'a'.repeat(41), TEXTO_VALIDACION_LARGO],
    ])('CA-RF10-F11 el aviso de nombre %s desaparece al editar el campo', async (_caso, nombre, aviso) => {
      await abrirHoja();
      await escribirYGuardar(nombre);
      await screen.findByText(aviso);

      await fireEvent.changeText(campoNombre(), 'Plantas');

      expect(screen.queryByText(aviso)).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('CA-RF10-F27 un nombre igual al de una categoría de la lista se envía igual: decide el backend', async () => {
      await abrirHoja();

      await escribirYGuardar('Alimentación');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Alimentación', tipo: 'EGRESO' });
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('guardando: carga y doble toque (RNF-02)', () => {
    it('CA-RF10-F12 mientras el backend no responde "Guardar" muestra un indicador, no se puede tocar de nuevo y la hoja sigue abierta', async () => {
      const respuesta = pendiente<Categoria>();
      crear.mockReturnValueOnce(respuesta.promesa);
      await abrirHoja();

      await escribirYGuardar('Plantas');

      expect(screen.queryByText('Guardar')).toBeNull();
      expect(hojaAbierta()).toBe(true);
      expect(crear).toHaveBeenCalledTimes(1);
      await act(async () => respuesta.resolver({ ...plantas }));
    });

    it('CA-RF10-F13 dos toques seguidos en "Guardar" envían una sola solicitud con una sola clave', async () => {
      const respuesta = pendiente<Categoria>();
      crear.mockReturnValueOnce(respuesta.promesa);
      await abrirHoja();
      await fireEvent.changeText(campoNombre(), 'Plantas');
      const boton = guardar();

      await fireEvent.press(boton);
      await fireEvent.press(boton);

      expect(crear).toHaveBeenCalledTimes(1);
      await act(async () => respuesta.resolver({ ...plantas }));
      expect(crear).toHaveBeenCalledTimes(1);
    });

    it('CA-RF10-F14 cada acción nueva lleva su propia clave, aunque los datos sean iguales', async () => {
      await abrirHoja();
      await escribirYGuardar('Plantas');
      await waitFor(() => expect(hojaAbierta()).toBe(false));

      await fireEvent.press(botonAgregar());
      await screen.findByText('Nueva categoría');
      await escribirYGuardar('Plantas');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      const [primera, segunda] = clavesUsadas();
      expect(primera).toMatch(UUID);
      expect(segunda).toMatch(UUID);
      expect(segunda).not.toBe(primera);
      expect(crear.mock.calls[1][0]).toEqual(crear.mock.calls[0][0]);
    });
  });

  describe('al crear con éxito', () => {
    it('CA-RF10-F15 se cierra la hoja, no hay avisos y la categoría nueva queda elegida', async () => {
      const alElegir = await abrirHoja();

      await escribirYGuardar('Plantas');

      await waitFor(() => expect(hojaAbierta()).toBe(false));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(alElegir).toHaveBeenCalledTimes(1);
      expect(alElegir).toHaveBeenCalledWith(plantas);
    });

    it('CA-RF10-F15 la categoría nueva aparece en la lista con la etiqueta "Personal", sin volver a pedir la lista', async () => {
      await abrirHoja();
      expect(screen.getAllByText('Personal')).toHaveLength(1);

      await escribirYGuardar('Plantas');

      expect(await screen.findByLabelText('Plantas')).toBeOnTheScreen();
      expect(screen.getAllByText('Personal')).toHaveLength(2);
      expect(listar).toHaveBeenCalledTimes(1);
    });

    it('CA-RF10-F15 se usa lo que devolvió el 201 aunque el backend lo normalice (por ejemplo, sin espacios)', async () => {
      crear.mockResolvedValueOnce({ ...plantas, nombre: 'Plantas del patio', id: 'c21' });
      const alElegir = await abrirHoja();

      await escribirYGuardar('  plantas del patio ');

      expect(await screen.findByLabelText('Plantas del patio')).toBeOnTheScreen();
      expect(alElegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'c21' }));
    });
  });

  describe('errores al guardar', () => {
    it.each([
      ['el mensaje de nombre repetido', 'Ya existe una categoría con ese nombre'],
      ['otro mensaje del backend', 'La petición ya se está procesando: espera su resultado'],
    ])('CA-RF10-F16 un 409 con %s avisa que el nombre está repetido y permite corregir', async (_caso, mensaje) => {
      crear.mockRejectedValueOnce(new ApiError(409, mensaje));
      const alElegir = await abrirHoja();

      await escribirYGuardar('Mascotas');

      expect(await screen.findByText(TEXTO_REPETIDO)).toBeOnTheScreen();
      expect(screen.queryByText(mensaje)).toBeNull();
      expect(hojaAbierta()).toBe(true);
      expect(campoNombre()).toHaveDisplayValue('Mascotas');
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
      expect(alElegir).not.toHaveBeenCalled();
    });

    it('CA-RF10-F17 sin conexión avisa, conserva el nombre y reintenta con la misma clave hasta lograrlo', async () => {
      crear.mockRejectedValueOnce(new NetworkError());
      const alElegir = await abrirHoja();

      await escribirYGuardar('Plantas');

      expect(await screen.findByText(TEXTO_RED)).toBeOnTheScreen();
      expect(hojaAbierta()).toBe(true);
      expect(campoNombre()).toHaveDisplayValue('Plantas');

      await fireEvent.press(guardar());

      await waitFor(() => expect(hojaAbierta()).toBe(false));
      expect(crear).toHaveBeenCalledTimes(2);
      expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
      expect(crear.mock.calls[1][0]).toEqual(crear.mock.calls[0][0]);
      expect(screen.queryByText(TEXTO_RED)).toBeNull();
      expect(alElegir).toHaveBeenCalledWith(plantas);
    });

    it.each([400, 422, 500])(
      'CA-RF10-F18 ante un %s muestra el mensaje general, sin textos del backend, y reintenta con la misma clave',
      async (status) => {
        crear.mockRejectedValueOnce(new ApiError(status, 'nombre debe tener máximo 40 caracteres'));
        await abrirHoja();

        await escribirYGuardar('Plantas');

        expect(await screen.findByText(TEXTO_GENERAL)).toBeOnTheScreen();
        expect(screen.queryByText(/máximo 40 caracteres/)).toBeNull();
        expect(hojaAbierta()).toBe(true);
        expect(campoNombre()).toHaveDisplayValue('Plantas');

        await fireEvent.press(guardar());

        await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
        expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
      },
    );

    it.each([
      ['falta de conexión', () => new NetworkError(), TEXTO_RED],
      ['un nombre repetido (409)', () => new ApiError(409, 'x'), TEXTO_REPETIDO],
      ['un error del servidor (500)', () => new ApiError(500, 'x'), TEXTO_GENERAL],
    ])(
      'CA-RF10-F19 si el primer intento falló por %s y el usuario cambia el nombre, es una acción nueva con otra clave',
      async (_caso, error, aviso) => {
        crear.mockRejectedValueOnce(error());
        await abrirHoja();
        await escribirYGuardar('Plantas');
        await screen.findByText(aviso);

        await escribirYGuardar('Jardín');

        await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
        expect(crear.mock.calls[1][0]).toEqual({ nombre: 'Jardín', tipo: 'EGRESO' });
        expect(crear.mock.calls[1][1]).toMatch(UUID);
        expect(crear.mock.calls[1][1]).not.toBe(crear.mock.calls[0][1]);
      },
    );

    it('CA-RF10-F20 ante un 401 la hoja no muestra un aviso de error propio', async () => {
      crear.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));
      await abrirHoja();

      await escribirYGuardar('Plantas');

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByText('Guardar')).not.toBeNull());
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('accesibilidad y lenguaje (RNF-04, RNF-06)', () => {
    it('CA-RF10-F21 el campo se anuncia como "Nombre", los botones tienen su nombre y los avisos son alertas', async () => {
      await abrirLista();
      expect(screen.getByRole('button', { name: 'Agregar categoría' })).toBeOnTheScreen();
      await fireEvent.press(botonAgregar());
      await screen.findByText('Nueva categoría');

      expect(screen.getByLabelText('Nombre')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeOnTheScreen();

      await fireEvent.press(guardar());
      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_VALIDACION_VACIO);
    });

    it.each([
      ['validación', null, ''],
      ['nombre repetido', new ApiError(409, 'Ya existe una categoría con ese nombre'), 'Plantas'],
      ['sin conexión', new NetworkError(), 'Plantas'],
      ['error del servidor', new ApiError(500, 'Internal server error'), 'Plantas'],
    ])(
      'CA-RF10-F22 el aviso de %s no usa términos técnicos ni contables',
      async (_caso, error, nombre) => {
        if (error) crear.mockRejectedValueOnce(error);
        await abrirHoja();

        await escribirYGuardar(nombre);

        const alerta = await screen.findByRole('alert');
        expect(alerta).not.toHaveTextContent(
          /409|422|500|400|idempotenc|payload|INGRESO|EGRESO|ApiError|NetworkError|internal server/i,
        );
        expect(alerta).toHaveTextContent(/categoría|nombre|internet|servidor/i);
      },
    );
  });
});
