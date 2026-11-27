import {
  crearCategoria,
  listarCategorias,
  renombrarCategoria,
  type Categoria,
} from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  abrirEdicion,
  campoNombre,
  cargada,
  crearServidor,
  escribir,
  fila,
  GENERALES_EGRESO,
  GENERALES_INGRESO,
  GIMNASIO,
  MASCOTAS,
  montar,
  mostrar,
  reiniciarAdaptador,
  TECNICO,
  TEXTO,
  verIngresos,
} from './ayudas/categorias';
import { reiniciarRouter, router } from './ayudas/router-simulado';
import { boton, laHoja, pendiente, RED, textoDePantalla } from './ayudas/tarjetas';

// Pantalla "Mis categorías": ver, cambiar de tipo, estados de carga y fallo, y crear
// (criterios/02-categorias-gestion.md, CA-RF11-F02 a F11 y F20).
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/categorias', () => ({
  listarCategorias: jest.fn(),
  crearCategoria: jest.fn(),
  renombrarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
}));

const listar = jest.mocked(listarCategorias);
const crear = jest.mocked(crearCategoria);

const hay = (texto: string) => screen.queryByText(texto) !== null;
const hayNueva = () => screen.queryByRole('button', { name: /^\+ Nueva categoría/ }) !== null;
const textos = (patron: RegExp) =>
  screen.getAllByText(patron).map((e) => [e.props.children].flat().join(''));

function sinLista() {
  expect(hay('TUS CATEGORÍAS')).toBe(false);
  expect(hay('GENERALES')).toBe(false);
  expect(hayNueva()).toBe(false);
}

beforeEach(() => {
  reiniciarRouter();
  reiniciarAdaptador();
});

describe('Mis categorías: encabezado y carga', () => {
  it('CA-RF11-F02 muestra el título "Mis categorías" y "Volver" regresa a la pantalla anterior', async () => {
    await mostrar();

    expect(screen.getByText('Mis categorías')).toBeOnTheScreen();
    await fireEvent.press(boton('Volver'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('CA-RF11-F03 mientras carga muestra el encabezado, el selector y el indicador, sin secciones ni avisos', async () => {
    listar.mockReturnValue(pendiente<Categoria[]>().promesa);

    await montar();

    expect(screen.getByText('Mis categorías')).toBeOnTheScreen();
    expect(boton('Egresos')).toBeOnTheScreen();
    expect(boton('Ingresos')).toBeOnTheScreen();
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    sinLista();
    expect(hay(TEXTO.sinPropias)).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Mis categorías: la lista', () => {
  it('CA-RF11-F04 abre en "Egresos" y consulta solo las de egreso', async () => {
    await mostrar();

    expect(boton('Egresos')).toBeSelected();
    expect(boton('Ingresos')).not.toBeSelected();
    expect(listar).toHaveBeenCalled();
    expect(listar.mock.calls.every(([tipo]) => tipo === 'EGRESO')).toBe(true);
    expect(hay('Freelance')).toBe(false);
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();
  });

  it('CA-RF11-F04 separa propias y generales, en el orden del backend, con los conteos solo en las propias', async () => {
    await mostrar();

    expect(
      textos(
        /^(TUS CATEGORÍAS|Mascotas|Gimnasio|\+ Nueva categoría de egreso|GENERALES|Alimentación|Transporte|Hogar|Salud|Otros egresos|Las categorías generales.*)$/,
      ),
    ).toEqual([
      'TUS CATEGORÍAS',
      'Mascotas',
      'Gimnasio',
      '+ Nueva categoría de egreso',
      'GENERALES',
      'Alimentación',
      'Transporte',
      'Hogar',
      'Salud',
      'Otros egresos',
      TEXTO.notaGenerales,
    ]);
    expect(screen.getByText('12 movimientos')).toBeOnTheScreen();
    expect(screen.getByText('4 movimientos')).toBeOnTheScreen();
    // "Alimentación" tiene 7 movimientos, pero de las generales solo se muestra el nombre
    expect(screen.queryByText(/7 movimientos/)).toBeNull();
  });

  it('CA-RF11-F05 dice "1 movimiento" en singular y "0 movimientos" en cero', async () => {
    await mostrar([
      ...GENERALES_EGRESO,
      { ...MASCOTAS, movimientos: 1 },
      { ...GIMNASIO, movimientos: 0 },
    ]);

    expect(screen.getByText('1 movimiento')).toBeOnTheScreen();
    expect(screen.getByText('0 movimientos')).toBeOnTheScreen();
    expect(fila('Mascotas', 1)).toBeOnTheScreen();
    expect(fila('Gimnasio', 0)).toBeOnTheScreen();
  });

  it('CA-RF11-F06 "Ingresos" muestra el indicador (no los egresos) y luego las de ingreso; "Egresos" regresa', async () => {
    await mostrar();
    const respuesta = pendiente<Categoria[]>();
    listar.mockReturnValueOnce(respuesta.promesa);

    await fireEvent.press(boton('Ingresos'));

    expect(boton('Ingresos')).toBeSelected();
    expect(boton('Egresos')).not.toBeSelected();
    expect(listar).toHaveBeenLastCalledWith('INGRESO');
    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(hay('Mascotas')).toBe(false);
    expect(hay('Alimentación')).toBe(false);

    await act(async () =>
      respuesta.resolver([...GENERALES_INGRESO, { ...GIMNASIO, nombre: 'Becas', tipo: 'INGRESO' }]),
    );
    expect(screen.getByText('TUS CATEGORÍAS')).toBeOnTheScreen();
    expect(screen.getByText('Becas')).toBeOnTheScreen();
    expect(screen.getByText('GENERALES')).toBeOnTheScreen();
    expect(screen.getByText('Otros ingresos')).toBeOnTheScreen();
    expect(boton('+ Nueva categoría de ingreso')).toBeOnTheScreen();

    await fireEvent.press(boton('Egresos'));

    expect(await screen.findByText('Mascotas')).toBeOnTheScreen();
    expect(hay('Becas')).toBe(false);
    expect(boton('Egresos')).toBeSelected();
  });

  it('CA-RF11-F07 sin categorías propias lo dice y deja el botón de nueva y las generales', async () => {
    await mostrar([...GENERALES_EGRESO, ...GENERALES_INGRESO]);

    expect(
      textos(/^(TUS CATEGORÍAS|Todavía no tienes.*|\+ Nueva categoría de egreso|GENERALES)$/),
    ).toEqual(['TUS CATEGORÍAS', TEXTO.sinPropias, '+ Nueva categoría de egreso', 'GENERALES']);
    expect(screen.getByText('Alimentación')).toBeOnTheScreen();

    await verIngresos();

    expect(screen.getByText(TEXTO.sinPropias)).toBeOnTheScreen();
  });

  it('CA-RF11-F08 las generales no son botones y tocarlas no abre nada', async () => {
    await mostrar();

    for (const { nombre } of GENERALES_EGRESO) {
      expect(screen.queryByRole('button', { name: new RegExp(nombre) })).toBeNull();
      await fireEvent.press(screen.getByText(nombre));
    }

    expect(hay('Editar categoría')).toBe(false);
    expect(hay('Eliminar categoría')).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('Mis categorías: cuando la consulta falla', () => {
  it.each([
    ['sin conexión', new NetworkError(), RED],
    ['con un 500', new ApiError(500, 'Internal server error'), TEXTO.errorCarga],
  ])(
    'CA-RF11-F09 %s avisa, ofrece "Reintentar" y deja el selector y "Volver"',
    async (_, error, aviso) => {
      crearServidor();
      listar.mockRejectedValueOnce(error);

      await montar();

      expect(await screen.findByRole('alert')).toHaveTextContent(aviso);
      sinLista();
      expect(boton('Egresos')).toBeOnTheScreen();
      expect(boton('Ingresos')).toBeOnTheScreen();
      expect(boton('Volver')).toBeOnTheScreen();
      expect(textoDePantalla()).not.toMatch(TECNICO);
      expect(boton('Reintentar')).toBeOnTheScreen();
    },
  );

  it('CA-RF11-F09 "Reintentar" vuelve a cargar el mismo tipo y muestra la lista', async () => {
    crearServidor();
    await montar();
    await cargada();
    listar.mockRejectedValueOnce(new NetworkError());
    await fireEvent.press(boton('Ingresos'));
    await screen.findByRole('alert');
    const respuesta = pendiente<Categoria[]>();
    listar.mockReturnValueOnce(respuesta.promesa);

    await fireEvent.press(boton('Reintentar'));

    expect(screen.getByLabelText(TEXTO.cargando)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(listar).toHaveBeenLastCalledWith('INGRESO');
    await act(async () => respuesta.resolver(GENERALES_INGRESO));
    expect(screen.getByText('Salario')).toBeOnTheScreen();
  });

  it('CA-RF11-F09 ante un 401 no muestra aviso propio', async () => {
    listar.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await montar();
    await act(async () => {});

    expect(listar).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    sinLista();
  });
});

describe('Mis categorías: crear', () => {
  it.each([
    ['Egresos', '+ Nueva categoría de egreso', 'Egreso'],
    ['Ingresos', '+ Nueva categoría de ingreso', 'Ingreso'],
  ])(
    'CA-RF11-F10 con "%s" el botón abre "Nueva categoría" con ese tipo',
    async (selector, nueva, tipo) => {
      await mostrar();
      if (selector === 'Ingresos') await verIngresos();

      await fireEvent.press(boton(nueva));

      expect(laHoja().getByText('Nueva categoría')).toBeOnTheScreen();
      expect(laHoja().getByText(tipo)).toBeOnTheScreen();
      expect(campoNombre()).toHaveDisplayValue('');
    },
  );

  it('CA-RF11-F11 tras crear cierra la hoja, vuelve a pedir la lista sin parpadeo y muestra la nueva', async () => {
    await mostrar();
    await fireEvent.press(boton('+ Nueva categoría de egreso'));
    await escribir('Plantas');
    const respuesta = pendiente<Categoria[]>();
    listar.mockClear();
    listar.mockReturnValueOnce(respuesta.promesa);

    await fireEvent.press(boton('Guardar'));

    await waitFor(() => expect(hay('Nueva categoría')).toBe(false));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0][0]).toEqual({ nombre: 'Plantas', tipo: 'EGRESO' });
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith('EGRESO');
    // Mientras llega la nueva lista se sigue viendo la anterior
    expect(screen.getByText('Mascotas')).toBeOnTheScreen();
    expect(screen.queryByLabelText(TEXTO.cargando)).toBeNull();

    const plantas = { ...MASCOTAS, id: 'c-nueva', nombre: 'Plantas', movimientos: 0 };
    await act(async () => respuesta.resolver([...GENERALES_EGRESO, MASCOTAS, plantas]));

    expect(fila('Plantas', 0)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Mis categorías: accesibilidad y lenguaje', () => {
  it('CA-RF11-F20 las propias son botones con nombre y conteo, y el selector anuncia cuál está elegido', async () => {
    await mostrar();

    expect(boton('Mascotas, 12 movimientos')).toBeOnTheScreen();
    expect(boton('Gimnasio, 4 movimientos')).toBeOnTheScreen();
    expect(boton('Egresos')).toBeSelected();
    expect(boton('Ingresos')).not.toBeSelected();
    expect(textoDePantalla()).not.toMatch(TECNICO);
  });

  it('CA-RF11-F20 en la hoja el campo se llama "Nombre" y el error es una alerta sin mensajes del backend', async () => {
    await mostrar();
    await abrirEdicion();
    jest.mocked(renombrarCategoria).mockRejectedValueOnce(new ApiError(403, 'Forbidden resource'));
    await escribir('Animales');

    expect(campoNombre()).toHaveDisplayValue('Animales');
    await fireEvent.press(boton('Guardar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorGuardar);
    expect(textoDePantalla()).not.toMatch(TECNICO);
  });
});
