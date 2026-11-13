import Cargos from '@/app/tarjetas/[id]/cargos';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarCargo,
  crearCargo,
  eliminarCargo,
  listarCargos,
  type CargoFijo,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  crearServidorDeCargos,
  GIMNASIO,
  NETFLIX,
  SPOTIFY,
  VISA_ID,
} from './ayudas/datos-tarjetas';
import {
  alternar,
  boton,
  interruptor,
  pendiente,
  RED,
  textoDePantalla,
  UUID,
  volverDeLaHoja,
} from './ayudas/tarjetas';

// Formulario del cargo fijo (hoja "Nuevo cargo fijo" / "Editar cargo fijo"): contenido, validación, guardar,
// activar o desactivar y errores al guardar (criterios/05-tarjetas-pantallas.md, CA-RF29-F13 a F31).
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: '66a0b3c4d5e6f70012ab34cd', nombre: 'Visa Bancolombia' }),
}));
jest.mock('@/lib/api/tarjetas', () => ({
  listarCargos: jest.fn(),
  crearCargo: jest.fn(),
  actualizarCargo: jest.fn(),
  eliminarCargo: jest.fn(),
}));

const listar = jest.mocked(listarCargos);
const crear = jest.mocked(crearCargo);
const actualizar = jest.mocked(actualizarCargo);
const eliminar = jest.mocked(eliminarCargo);

const TEXTO = {
  descripcionVacia: 'Escribe una descripción para el cargo.',
  descripcionLarga: 'La descripción no puede tener más de 100 caracteres.',
  valorVacio: 'Escribe un valor mayor que cero.',
  tarjetaNoExiste: 'Esta tarjeta ya no existe.',
  cargoNoExiste: 'Este cargo fijo ya no existe.',
  errorGuardar: 'No pudimos guardar el cargo fijo. Revisa los datos e inténtalo de nuevo.',
};
const ACTIVO = 'Activo este mes';

let servidor: ReturnType<typeof crearServidorDeCargos>;

const campoDescripcion = () => screen.getByLabelText('Descripción');
const campoValor = () => screen.getByLabelText('Monto en pesos');
const guardar = () => boton('Guardar cargo fijo');
const escribirDescripcion = (texto: string) => fireEvent.changeText(campoDescripcion(), texto);
const escribirValor = (texto: string) => fireEvent.changeText(campoValor(), texto);
const fila = (c: CargoFijo, valor: string) => boton(`${c.descripcion}, $ ${valor} al mes`);
const hojaCerrada = () =>
  waitFor(() => {
    expect(screen.queryByText('Nuevo cargo fijo')).toBeNull();
    expect(screen.queryByText('Editar cargo fijo')).toBeNull();
  });
const posicion = (texto: string) => textoDePantalla().indexOf(texto);

async function mostrar(cargos: CargoFijo[]) {
  servidor = crearServidorDeCargos(cargos);
  listar.mockImplementation(async () => servidor.listar());
  crear.mockImplementation(async (tarjetaId, datos) => servidor.crear(tarjetaId, datos));
  actualizar.mockImplementation(async (tarjetaId, id, cambios) =>
    servidor.actualizar(tarjetaId, id, cambios),
  );
  await render(<Cargos />);
  await screen.findByRole('button', { name: '+ Agregar cargo fijo' });
}
/** Hoja "Nuevo cargo fijo" con una descripción y un valor ya escritos (la lista de fondo solo tiene a Spotify). */
async function nuevoLleno(descripcion = 'Netflix', valor = '45000') {
  await mostrar([SPOTIFY]);
  await fireEvent.press(boton('+ Agregar cargo fijo'));
  await screen.findByText('Nuevo cargo fijo');
  await escribirDescripcion(descripcion);
  await escribirValor(valor);
}
async function abrirEdicion(cargo: CargoFijo = NETFLIX, valor = '45.000') {
  await mostrar([NETFLIX, SPOTIFY, GIMNASIO]);
  await fireEvent.press(fila(cargo, valor));
  await screen.findByText('Editar cargo fijo');
}

beforeEach(() => {
  listar.mockReset().mockResolvedValue([]);
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Formulario de cargo: qué contiene', () => {
  it('CA-RF29-F13 "Nuevo cargo fijo" tiene título, "Volver", "Descripción", "Valor al mes", el interruptor y "Guardar cargo fijo", y no "Eliminar cargo fijo"', async () => {
    await nuevoLleno('', '');

    expect(screen.getByText('Nuevo cargo fijo')).toBeOnTheScreen();
    expect(volverDeLaHoja('Nuevo cargo fijo')).toBeOnTheScreen();
    expect(campoDescripcion().props.placeholder).toBe('Ej: Netflix');
    expect(campoValor().props.placeholder).toBe('$ 0');
    expect(screen.getByText('Valor al mes')).toBeOnTheScreen();
    expect(interruptor(ACTIVO)).toBeOnTheScreen();
    expect(guardar()).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Eliminar cargo fijo' })).toBeNull();
  });

  it('CA-RF29-F13 "Editar cargo fijo" suma "Eliminar cargo fijo"', async () => {
    await abrirEdicion();

    expect(screen.getByText('Editar cargo fijo')).toBeOnTheScreen();
    expect(volverDeLaHoja('Editar cargo fijo')).toBeOnTheScreen();
    expect(campoDescripcion().props.placeholder).toBe('Ej: Netflix');
    expect(campoValor().props.placeholder).toBe('$ 0');
    expect(screen.getByText('Valor al mes')).toBeOnTheScreen();
    expect(interruptor(ACTIVO)).toBeOnTheScreen();
    expect(guardar()).toBeOnTheScreen();
    expect(boton('Eliminar cargo fijo')).toBeOnTheScreen();
  });

  it.each([
    ['nuevo', async () => nuevoLleno(), 'Nuevo cargo fijo'],
    ['de editar', async () => abrirEdicion(), 'Editar cargo fijo'],
  ])(
    'CA-RF29-F14 "Volver" cierra la hoja %s sin guardar, aunque haya cambios escritos',
    async (_caso, abrir, titulo) => {
      await abrir();
      await escribirDescripcion('Cambio sin guardar');

      await fireEvent.press(volverDeLaHoja(titulo));

      await hojaCerrada();
      expect(crear).not.toHaveBeenCalled();
      expect(actualizar).not.toHaveBeenCalled();
      expect(eliminar).not.toHaveBeenCalled();
    },
  );

  it('CA-RF29-F14 tras "Volver" la lista queda igual', async () => {
    await abrirEdicion();
    await escribirDescripcion('Cambio sin guardar');
    await fireEvent.press(volverDeLaHoja('Editar cargo fijo'));
    await hojaCerrada();

    expect(screen.getByText(/Netflix/)).toBeOnTheScreen();
    expect(screen.getByText(/\$ 45\.000 al mes/)).toBeOnTheScreen();
  });

  it('CA-RF29-F15 el interruptor "Activo este mes" cambia al tocarlo: apagado y, al tocarlo otra vez, encendido', async () => {
    await nuevoLleno();
    expect(interruptor(ACTIVO)).toBeChecked();

    await alternar(ACTIVO);
    expect(interruptor(ACTIVO)).not.toBeChecked();

    await alternar(ACTIVO);
    expect(interruptor(ACTIVO)).toBeChecked();
  });
});

describe('Formulario de cargo: validación antes de llamar al backend', () => {
  it.each([
    ['vacía', ''],
    ['solo con espacios', '   '],
  ])('CA-RF29-F16 una descripción %s no se envía y avisa', async (_caso, descripcion) => {
    await nuevoLleno(descripcion, '45000');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.descripcionVacia);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F16 al editar, dejar la descripción vacía tampoco se envía', async () => {
    await abrirEdicion();
    await escribirDescripcion('');

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.descripcionVacia)).toBeOnTheScreen();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F17 una descripción de 101 caracteres no se envía y avisa', async () => {
    await nuevoLleno('a'.repeat(101), '45000');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.descripcionLarga);
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF29-F17 una descripción de 100 caracteres sí se envía', async () => {
    await nuevoLleno('a'.repeat(100), '45000');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][1].descripcion).toBe('a'.repeat(100));
    expect(screen.queryByText(TEXTO.descripcionLarga)).toBeNull();
  });

  it('CA-RF29-F17 los espacios de los extremos no cuentan para el límite', async () => {
    await nuevoLleno(`  ${'a'.repeat(100)}  `, '45000');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(TEXTO.descripcionLarga)).toBeNull();
  });

  it.each([
    ['vacío', ''],
    ['en cero', '0'],
  ])('CA-RF29-F18 un valor %s no se envía y avisa', async (_caso, valor) => {
    await nuevoLleno('Netflix', valor);

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.valorVacio);
    expect(campoValor()).toHaveDisplayValue('');
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F18 al editar, dejar el valor vacío tampoco se envía', async () => {
    await abrirEdicion();
    await escribirValor('');

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.valorVacio)).toBeOnTheScreen();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it.each([
    ['la descripción', () => escribirDescripcion('Disney')],
    ['el valor', () => escribirValor('30000')],
    ['el interruptor', () => alternar(ACTIVO)],
  ])('CA-RF29-F18 el aviso desaparece al editar %s', async (_campo, editar) => {
    await nuevoLleno('Netflix', '');
    await fireEvent.press(guardar());
    await screen.findByRole('alert');

    await editar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.valorVacio)).toBeNull();
  });

  it('CA-RF29-F13 el campo del valor escribe solo dígitos con puntos de miles y un tope de 12 dígitos', async () => {
    await nuevoLleno('Netflix', '');

    await escribirValor('45000');
    expect(campoValor()).toHaveDisplayValue('$ 45.000');
    await escribirValor('abc-500');
    expect(campoValor()).toHaveDisplayValue('$ 500');
    await escribirValor('1234567890123');
    expect(campoValor()).toHaveDisplayValue('$ 123.456.789.012');
  });
});

describe('Guardar un cargo nuevo', () => {
  it('CA-RF29-F19 "Guardar cargo fijo" crea con el cuerpo exacto y una clave UUID, y nada más', async () => {
    await nuevoLleno('  Netflix  ', '45000');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear).toHaveBeenCalledWith(
      VISA_ID,
      { descripcion: 'Netflix', valor: 45000, activo: true },
      expect.stringMatching(UUID),
    );
    expect(Object.keys(crear.mock.calls[0][1]).sort()).toEqual(['activo', 'descripcion', 'valor']);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F19 con el interruptor apagado envía activo: false (el campo siempre va)', async () => {
    await nuevoLleno();
    await alternar(ACTIVO);

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][1]).toEqual({ descripcion: 'Netflix', valor: 45000, activo: false });
  });

  it('CA-RF29-F20 al crear, la hoja se cierra, la lista se vuelve a pedir y el cargo aparece una sola vez en "ACTIVOS ESTE MES"', async () => {
    await nuevoLleno();

    await fireEvent.press(guardar());

    await hojaCerrada();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText(/Netflix/)).toHaveLength(1);
    expect(screen.getByText(/\$ 45\.000 al mes/)).toBeOnTheScreen();
    expect(posicion('ACTIVOS ESTE MES')).toBeLessThan(posicion('Netflix'));
    expect(textoDePantalla()).not.toContain('INACTIVOS');
    expect(textoDePantalla()).not.toMatch(/guardad/i);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF29-F20 si se creó apagado aparece en "INACTIVOS"', async () => {
    await nuevoLleno();
    await alternar(ACTIVO);

    await fireEvent.press(guardar());

    await hojaCerrada();
    expect(await screen.findAllByText(/Netflix/)).toHaveLength(1);
    expect(posicion('INACTIVOS')).toBeGreaterThanOrEqual(0);
    expect(posicion('INACTIVOS')).toBeLessThan(posicion('Netflix'));
  });

  it('CA-RF29-F21 mientras guarda, el botón muestra un indicador, no se puede tocar y la hoja sigue abierta con lo escrito', async () => {
    const respuesta = pendiente<CargoFijo>();
    await nuevoLleno();
    crear.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);

    expect(screen.queryByText('Guardar cargo fijo')).toBeNull();
    expect(botonGuardar).toBeDisabled();
    expect(screen.getByText('Nuevo cargo fijo')).toBeOnTheScreen();
    expect(campoDescripcion()).toHaveDisplayValue('Netflix');
    expect(campoValor()).toHaveDisplayValue('$ 45.000');
    await act(async () => respuesta.resolver({ ...NETFLIX }));
  });

  it('CA-RF29-F21 dos toques seguidos envían una sola solicitud con una sola clave', async () => {
    const respuesta = pendiente<CargoFijo>();
    await nuevoLleno();
    crear.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(crear).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver({ ...NETFLIX }));
    expect(crear).toHaveBeenCalledTimes(1);
  });
});

describe('Editar un cargo y activarlo o desactivarlo', () => {
  it('CA-RF29-F22 al cambiar solo el valor envía solo el valor, sin clave', async () => {
    await abrirEdicion();
    await escribirValor('49900');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, NETFLIX.id, { valor: 49900 });
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF29-F22 al cambiar la descripción y el valor envía los dos', async () => {
    await abrirEdicion();
    await escribirDescripcion('Netflix HD');
    await escribirValor('49900');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, NETFLIX.id, {
      descripcion: 'Netflix HD',
      valor: 49900,
    });
  });

  it('CA-RF29-F22 la misma descripción con espacios sobrantes no cuenta como cambio', async () => {
    await abrirEdicion();
    await escribirDescripcion('  Netflix  ');

    await fireEvent.press(guardar());

    await hojaCerrada();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F23 al apagar "Activo este mes" envía solo activo: false y "Netflix" pasa a "INACTIVOS"', async () => {
    await abrirEdicion();
    await alternar(ACTIVO);

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, NETFLIX.id, { activo: false });
    await hojaCerrada();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText(/Netflix/)).toHaveLength(1);
    expect(posicion('INACTIVOS')).toBeLessThan(posicion('Netflix'));
    expect(posicion('ACTIVOS ESTE MES')).toBeLessThan(posicion('Spotify'));
    expect(posicion('Spotify')).toBeLessThan(posicion('INACTIVOS'));
  });

  it('CA-RF29-F24 al encender "Activo este mes" de un cargo inactivo envía activo: true y pasa a "ACTIVOS ESTE MES"', async () => {
    await abrirEdicion(GIMNASIO, '90.000');
    await alternar(ACTIVO);

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, GIMNASIO.id, { activo: true });
    await hojaCerrada();
    expect(await screen.findAllByText(/Gimnasio/)).toHaveLength(1);
    expect(posicion('ACTIVOS ESTE MES')).toBeLessThan(posicion('Gimnasio'));
    expect(textoDePantalla()).not.toContain('INACTIVOS');
  });

  it('CA-RF29-F25 guardar sin cambios no llama al backend y cierra la hoja', async () => {
    await abrirEdicion();

    await fireEvent.press(guardar());

    await hojaCerrada();
    expect(actualizar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF29-F26 dos toques seguidos al editar envían una sola solicitud y muestran el indicador', async () => {
    const respuesta = pendiente<CargoFijo>();
    await abrirEdicion();
    await escribirValor('49900');
    actualizar.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Guardar cargo fijo')).toBeNull();
    await act(async () => respuesta.resolver({ ...NETFLIX, valor: 49900 }));
    expect(actualizar).toHaveBeenCalledTimes(1);
  });
});

describe('Errores al guardar un cargo', () => {
  it('CA-RF29-F27 si la tarjeta ya no existe (404 al crear) avisa dentro de la hoja, que sigue abierta con lo escrito', async () => {
    await nuevoLleno();
    crear.mockRejectedValueOnce(new ApiError(404, 'Tarjeta no encontrada'));

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.tarjetaNoExiste);
    expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();
    expect(screen.getByText('Nuevo cargo fijo')).toBeOnTheScreen();
    expect(campoDescripcion()).toHaveDisplayValue('Netflix');
    expect(campoValor()).toHaveDisplayValue('$ 45.000');
  });

  it('CA-RF29-F27 si el cargo ya no existe (404 al editar) avisa y, al cerrar la hoja, la lista se vuelve a pedir y muestra lo que haya', async () => {
    await abrirEdicion();
    actualizar.mockImplementationOnce(async () => {
      servidor.items = servidor.items.filter((c) => c.id !== NETFLIX.id);
      throw new ApiError(404, 'Cargo fijo no encontrado');
    });
    await escribirValor('49900');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.cargoNoExiste);
    expect(screen.queryByText('Cargo fijo no encontrado')).toBeNull();
    expect(campoValor()).toHaveDisplayValue('$ 49.900');

    await fireEvent.press(volverDeLaHoja('Editar cargo fijo'));

    await hojaCerrada();
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(screen.queryByText(/Netflix/)).toBeNull());
    expect(screen.getByText(/Spotify/)).toBeOnTheScreen();
  });

  it('CA-RF29-F28 sin conexión al crear avisa, conserva lo escrito y reintenta con la misma clave y el mismo cuerpo', async () => {
    await nuevoLleno();
    crear.mockRejectedValueOnce(new NetworkError());

    await fireEvent.press(guardar());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(campoDescripcion()).toHaveDisplayValue('Netflix');
    expect(campoValor()).toHaveDisplayValue('$ 45.000');
    expect(guardar()).toBeEnabled();

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
    expect(crear.mock.calls[1][2]).toBe(crear.mock.calls[0][2]);
    expect(crear.mock.calls[1][1]).toEqual(crear.mock.calls[0][1]);
    await waitFor(() => expect(screen.queryByText(RED)).toBeNull());
    await hojaCerrada();
  });

  it('CA-RF29-F28 sin conexión al editar avisa, conserva lo escrito y reintenta el mismo cambio', async () => {
    await abrirEdicion();
    actualizar.mockRejectedValueOnce(new NetworkError());
    await escribirValor('49900');

    await fireEvent.press(guardar());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(campoValor()).toHaveDisplayValue('$ 49.900');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(2));
    expect(actualizar.mock.calls[1]).toEqual(actualizar.mock.calls[0]);
    await hojaCerrada();
    expect(screen.queryByText(RED)).toBeNull();
  });

  it.each([400, 422, 500])(
    'CA-RF29-F29 ante un %s al crear muestra el mensaje general, sin textos del backend, y reintenta con la misma clave',
    async (status) => {
      await nuevoLleno();
      crear.mockRejectedValueOnce(new ApiError(status, 'valor debe ser mayor que 0'));

      await fireEvent.press(guardar());

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorGuardar);
      expect(screen.queryByText(/valor debe ser/)).toBeNull();
      expect(campoDescripcion()).toHaveDisplayValue('Netflix');
      expect(campoValor()).toHaveDisplayValue('$ 45.000');

      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][2]).toBe(crear.mock.calls[0][2]);
    },
  );

  it.each([400, 500])(
    'CA-RF29-F29 ante un %s al editar muestra el mensaje general con la hoja abierta y lo escrito intacto',
    async (status) => {
      await abrirEdicion();
      actualizar.mockRejectedValueOnce(new ApiError(status, 'x'));
      await escribirValor('49900');

      await fireEvent.press(guardar());

      expect(await screen.findByText(TEXTO.errorGuardar)).toBeOnTheScreen();
      expect(screen.getByText('Editar cargo fijo')).toBeOnTheScreen();
      expect(campoValor()).toHaveDisplayValue('$ 49.900');
      expect(guardar()).toBeEnabled();
    },
  );

  it.each([
    ['falta de conexión', () => new NetworkError(), RED],
    ['un error del servidor (500)', () => new ApiError(500, 'x'), TEXTO.errorGuardar],
  ])(
    'CA-RF29-F30 si el primer intento falló por %s y el usuario cambia la descripción, es una acción nueva con otra clave',
    async (_caso, error, aviso) => {
      await nuevoLleno('Netflix', '45000');
      crear.mockRejectedValueOnce(error());
      await fireEvent.press(guardar());
      await screen.findByText(aviso);

      await escribirDescripcion('Disney');
      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][1]).toEqual({ descripcion: 'Disney', valor: 45000, activo: true });
      expect(crear.mock.calls[1][2]).toMatch(UUID);
      expect(crear.mock.calls[1][2]).not.toBe(crear.mock.calls[0][2]);
    },
  );

  it.each([
    [
      'el valor',
      () => escribirValor('30000'),
      { descripcion: 'Netflix', valor: 30000, activo: true },
    ],
    [
      'el interruptor',
      () => alternar(ACTIVO),
      { descripcion: 'Netflix', valor: 45000, activo: false },
    ],
  ])(
    'CA-RF29-F30 si el primer intento falló y el usuario cambia %s, es una acción nueva con otra clave',
    async (_campo, cambiar, cuerpo) => {
      await nuevoLleno('Netflix', '45000');
      crear.mockRejectedValueOnce(new ApiError(500, 'x'));
      await fireEvent.press(guardar());
      await screen.findByText(TEXTO.errorGuardar);

      await cambiar();
      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][1]).toEqual(cuerpo);
      expect(crear.mock.calls[1][2]).not.toBe(crear.mock.calls[0][2]);
    },
  );

  it('CA-RF29-F31 ante un 401 al guardar la hoja no muestra un aviso de error propio', async () => {
    await nuevoLleno();
    crear.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Guardar cargo fijo')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorGuardar)).toBeNull();
  });
});
