import Tarjetas from '@/app/tarjetas';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AMEX, crearServidorDeTarjetas, VISA, VISA_ID } from './ayudas/datos-tarjetas';
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

// Guardar una tarjeta nueva o editar una existente, y los errores al guardar
// (criterios/05-tarjetas-pantallas.md, CA-RF24-F25 a F39). El backend se simula con un servidor en memoria en el
// borde del adaptador: así las pruebas solo miran lo que ve el usuario.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
}));

const listar = jest.mocked(listarTarjetas);
const crear = jest.mocked(crearTarjeta);
const actualizar = jest.mocked(actualizarTarjeta);
const eliminar = jest.mocked(eliminarTarjeta);

const TEXTO = {
  repetido: 'Ya tienes una tarjeta con ese alias. Elige otro.',
  yaNoExiste: 'Esta tarjeta ya no existe.',
  errorGuardar: 'No pudimos guardar tu tarjeta. Revisa los datos e inténtalo de nuevo.',
};
const CUOTA = 'Compras a 1 cuota sin intereses';

let servidor: ReturnType<typeof crearServidorDeTarjetas>;

const campoAlias = () => screen.getByLabelText('Alias');
const campoTasa = () => screen.getByLabelText('Tasa de interés E.A.');
const guardar = () => boton('Guardar tarjeta');
const escribirAlias = (texto: string) => fireEvent.changeText(campoAlias(), texto);
const escribirTasa = (texto: string) => fireEvent.changeText(campoTasa(), texto);

async function mostrar(tarjetas: Tarjeta[]) {
  servidor = crearServidorDeTarjetas(tarjetas);
  listar.mockImplementation(servidor.listar);
  crear.mockImplementation(async (datos) => servidor.crear(datos));
  actualizar.mockImplementation(async (id, cambios) => servidor.actualizar(id, cambios));
  await render(<Tarjetas />);
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
}
/** Hoja "Nueva tarjeta" con un alias y una tasa ya escritos (la lista de fondo solo tiene a Amex). */
async function nuevaLlena(alias = 'Visa Bancolombia', tasa = '29,21') {
  await mostrar([AMEX]);
  await fireEvent.press(boton('+ Agregar tarjeta'));
  await screen.findByText('Nueva tarjeta');
  await escribirAlias(alias);
  await escribirTasa(tasa);
}
async function abrirEdicion() {
  await mostrar([VISA, AMEX]);
  await fireEvent.press(boton('Visa Bancolombia, Tasa 29,21 % E.A.'));
  await screen.findByText('Editar tarjeta');
}
const clavesUsadas = () => crear.mock.calls.map(([, clave]) => clave);

beforeEach(() => {
  listar.mockReset().mockResolvedValue([]);
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Guardar una tarjeta nueva', () => {
  it('CA-RF24-F25 "Guardar tarjeta" crea con el cuerpo exacto y una clave UUID, y nada más', async () => {
    await nuevaLlena('  Visa Bancolombia  ', '29,21');
    await alternar(CUOTA);

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear).toHaveBeenCalledWith(
      { nombre: 'Visa Bancolombia', tasaEA: 0.2921, cuotaUnicaSinInteres: true },
      expect.stringMatching(UUID),
    );
    expect(Object.keys(crear.mock.calls[0][0]).sort()).toEqual([
      'cuotaUnicaSinInteres',
      'nombre',
      'tasaEA',
    ]);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F25 con el interruptor apagado envía cuotaUnicaSinInteres: false (el campo siempre va)', async () => {
    await nuevaLlena('Visa Bancolombia', '29,21');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0]).toEqual({
      nombre: 'Visa Bancolombia',
      tasaEA: 0.2921,
      cuotaUnicaSinInteres: false,
    });
  });

  it('CA-RF24-F26 al crear, la hoja se cierra, la lista se vuelve a pedir y muestra la tarjeta una sola vez, sin aviso de guardada', async () => {
    await nuevaLlena();

    await fireEvent.press(guardar());

    await waitFor(() => expect(screen.queryByText('Nueva tarjeta')).toBeNull());
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Visa Bancolombia')).toHaveLength(1);
    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(textoDePantalla()).not.toMatch(/guardad/i);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF24-F26 la lista usa la respuesta del backend y su orden, sin ordenar ni insertar nada a mano', async () => {
    await nuevaLlena('Visa Oro', '29,21');
    // El backend devuelve la nueva primero y con el nombre que él guardó
    listar.mockReset().mockResolvedValue([{ ...VISA, id: 'n1', nombre: 'VISA ORO' }, { ...AMEX }]);

    await fireEvent.press(guardar());

    expect(await screen.findByText('VISA ORO')).toBeOnTheScreen();
    expect(screen.queryByText('Visa Oro')).toBeNull();
    const texto = textoDePantalla();
    expect(texto.indexOf('VISA ORO')).toBeLessThan(texto.indexOf('Amex'));
  });

  it('CA-RF24-F27 mientras guarda, el botón muestra un indicador, no se puede tocar y la hoja sigue abierta con lo escrito', async () => {
    const respuesta = pendiente<Tarjeta>();
    await nuevaLlena('Visa Oro', '29,21');
    crear.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);

    expect(screen.queryByText('Guardar tarjeta')).toBeNull();
    expect(botonGuardar).toBeDisabled();
    expect(screen.getByText('Nueva tarjeta')).toBeOnTheScreen();
    expect(campoAlias()).toHaveDisplayValue('Visa Oro');
    expect(campoTasa()).toHaveDisplayValue('29,21');
    await act(async () => respuesta.resolver({ ...VISA }));
  });

  it('CA-RF24-F28 dos toques seguidos en "Guardar tarjeta" envían una sola solicitud con una sola clave', async () => {
    const respuesta = pendiente<Tarjeta>();
    await nuevaLlena();
    crear.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(crear).toHaveBeenCalledTimes(1);
    await act(async () => respuesta.resolver({ ...VISA }));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(clavesUsadas()).toHaveLength(1);
  });
});

describe('Editar una tarjeta (y cambiar su tasa)', () => {
  it('CA-RF24-F29 al cambiar solo el alias envía solo el alias, sin clave', async () => {
    await abrirEdicion();
    await escribirAlias('Visa Oro');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, { nombre: 'Visa Oro' });
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF24-F29 al apagar solo el interruptor envía solo cuotaUnicaSinInteres: false', async () => {
    await abrirEdicion();
    await alternar(CUOTA);

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, { cuotaUnicaSinInteres: false });
  });

  it('CA-RF24-F29 al cambiar el alias y el interruptor envía los dos juntos', async () => {
    await abrirEdicion();
    await escribirAlias('Visa Oro');
    await alternar(CUOTA);

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, {
      nombre: 'Visa Oro',
      cuotaUnicaSinInteres: false,
    });
  });

  it('CA-RF24-F29 el mismo alias con espacios sobrantes y la misma tasa con otro formato no cuentan como cambio', async () => {
    await abrirEdicion();
    await escribirAlias('  Visa Bancolombia  ');
    await escribirTasa('29.21');

    await fireEvent.press(guardar());

    await waitFor(() => expect(screen.queryByText('Editar tarjeta')).toBeNull());
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F30 al cambiar la tasa envía solo la tasa nueva y la fila de la lista dice la nueva', async () => {
    await abrirEdicion();
    await escribirTasa('31,5');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar).toHaveBeenCalledWith(VISA_ID, { tasaEA: 0.315 });
    await hojaCerradaLuego();
    expect(await screen.findByText('Tasa 31,5 % E.A.')).toBeOnTheScreen();
    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Amex')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 24,21 % E.A.')).toBeOnTheScreen();
    expect(screen.queryByText('Tasa 29,21 % E.A.')).toBeNull();
  });

  it('CA-RF24-F31 guardar sin cambios no llama al backend y cierra la hoja', async () => {
    await abrirEdicion();

    await fireEvent.press(guardar());

    await waitFor(() => expect(screen.queryByText('Editar tarjeta')).toBeNull());
    expect(actualizar).not.toHaveBeenCalled();
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF24-F32 al editar con éxito la hoja se cierra, la lista se vuelve a pedir y muestra el nombre nuevo sin duplicar', async () => {
    await abrirEdicion();
    await escribirAlias('Visa Oro');

    await fireEvent.press(guardar());

    await hojaCerradaLuego();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Visa Oro')).toHaveLength(1);
    expect(screen.queryByText('Visa Bancolombia')).toBeNull();
    expect(screen.getAllByText(/^Tasa /)).toHaveLength(2);
  });

  it('CA-RF24-F33 dos toques seguidos al editar envían una sola solicitud y muestran el indicador', async () => {
    const respuesta = pendiente<Tarjeta>();
    await abrirEdicion();
    await escribirAlias('Visa Oro');
    actualizar.mockReturnValueOnce(respuesta.promesa);
    const botonGuardar = guardar();

    await fireEvent.press(botonGuardar);
    await fireEvent.press(botonGuardar);

    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Guardar tarjeta')).toBeNull();
    await act(async () => respuesta.resolver({ ...VISA, nombre: 'Visa Oro' }));
    expect(actualizar).toHaveBeenCalledTimes(1);
  });
});

async function hojaCerradaLuego() {
  await waitFor(() => {
    expect(screen.queryByText('Nueva tarjeta')).toBeNull();
    expect(screen.queryByText('Editar tarjeta')).toBeNull();
  });
}

describe('Errores al guardar una tarjeta', () => {
  it('CA-RF24-F34 un alias repetido (409) al crear avisa dentro de la hoja, que sigue abierta con lo escrito', async () => {
    crearConError(new ApiError(409, 'Ya existe una tarjeta con ese nombre'));
    await nuevaLlena('Amex', '24');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.repetido);
    expect(screen.queryByText('Ya existe una tarjeta con ese nombre')).toBeNull();
    expect(screen.getByText('Nueva tarjeta')).toBeOnTheScreen();
    expect(campoAlias()).toHaveDisplayValue('Amex');
    expect(campoTasa()).toHaveDisplayValue('24');
    expect(guardar()).toBeEnabled();
  });

  it('CA-RF24-F34 un alias repetido (409) al renombrar avisa igual y el aviso desaparece al cambiar el alias', async () => {
    await abrirEdicion();
    actualizar.mockRejectedValueOnce(new ApiError(409, 'Ya existe una tarjeta con ese nombre'));
    await escribirAlias('Amex');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.repetido);
    expect(screen.getByText('Editar tarjeta')).toBeOnTheScreen();
    expect(campoAlias()).toHaveDisplayValue('Amex');

    await escribirAlias('Amex 2');

    expect(screen.queryByText(TEXTO.repetido)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF24-F35 si la tarjeta ya no existe (404 al editar) avisa y, al cerrar la hoja, la lista ya no la muestra', async () => {
    await abrirEdicion();
    actualizar.mockImplementationOnce(async () => {
      servidor.items = servidor.items.filter((t) => t.id !== VISA_ID);
      throw new ApiError(404, 'Tarjeta no encontrada');
    });
    await escribirAlias('Visa Oro');

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.yaNoExiste)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.yaNoExiste);
    expect(screen.queryByText('Tarjeta no encontrada')).toBeNull();

    await fireEvent.press(volverDeLaHoja('Editar tarjeta'));

    await hojaCerradaLuego();
    await waitFor(() => expect(screen.queryByText('Visa Bancolombia')).toBeNull());
    expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Amex')).toBeOnTheScreen();
  });

  it('CA-RF24-F36 sin conexión al crear avisa, conserva lo escrito y reintenta con la misma clave y el mismo cuerpo', async () => {
    crearConError(new NetworkError());
    await nuevaLlena();

    await fireEvent.press(guardar());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(campoAlias()).toHaveDisplayValue('Visa Bancolombia');
    expect(campoTasa()).toHaveDisplayValue('29,21');
    expect(guardar()).toBeEnabled();

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
    expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
    expect(crear.mock.calls[1][0]).toEqual(crear.mock.calls[0][0]);
    await waitFor(() => expect(screen.queryByText(RED)).toBeNull());
    await hojaCerradaLuego();
  });

  it('CA-RF24-F36 sin conexión al editar avisa, conserva lo escrito y reintenta el mismo cambio', async () => {
    await abrirEdicion();
    actualizar.mockRejectedValueOnce(new NetworkError());
    await escribirAlias('Visa Oro');

    await fireEvent.press(guardar());

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(campoAlias()).toHaveDisplayValue('Visa Oro');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(2));
    expect(actualizar.mock.calls[1]).toEqual(actualizar.mock.calls[0]);
    await hojaCerradaLuego();
    expect(screen.queryByText(RED)).toBeNull();
  });

  it.each([400, 422, 500])(
    'CA-RF24-F37 ante un %s al crear muestra el mensaje general, sin textos del backend, y reintenta con la misma clave',
    async (status) => {
      crearConError(new ApiError(status, 'tasaEA debe ser un número'));
      await nuevaLlena();

      await fireEvent.press(guardar());

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorGuardar);
      expect(screen.queryByText(/tasaEA/)).toBeNull();
      expect(campoAlias()).toHaveDisplayValue('Visa Bancolombia');
      expect(campoTasa()).toHaveDisplayValue('29,21');

      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][1]).toBe(crear.mock.calls[0][1]);
    },
  );

  it.each([400, 500])(
    'CA-RF24-F37 ante un %s al editar muestra el mensaje general con la hoja abierta y lo escrito intacto',
    async (status) => {
      await abrirEdicion();
      actualizar.mockRejectedValueOnce(new ApiError(status, 'x'));
      await escribirAlias('Visa Oro');

      await fireEvent.press(guardar());

      expect(await screen.findByText(TEXTO.errorGuardar)).toBeOnTheScreen();
      expect(screen.getByText('Editar tarjeta')).toBeOnTheScreen();
      expect(campoAlias()).toHaveDisplayValue('Visa Oro');
      expect(guardar()).toBeEnabled();
    },
  );

  it.each([
    ['falta de conexión', () => new NetworkError(), RED],
    ['un alias repetido', () => new ApiError(409, 'x'), TEXTO.repetido],
    ['un error del servidor (500)', () => new ApiError(500, 'x'), TEXTO.errorGuardar],
  ])(
    'CA-RF24-F38 si el primer intento falló por %s y el usuario cambia el alias, es una acción nueva con otra clave',
    async (_caso, error, aviso) => {
      crearConError(error());
      await nuevaLlena('Visa Oro', '24');
      await fireEvent.press(guardar());
      await screen.findByText(aviso);

      await escribirAlias('Visa Plata');
      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][0]).toEqual({
        nombre: 'Visa Plata',
        tasaEA: 0.24,
        cuotaUnicaSinInteres: false,
      });
      expect(crear.mock.calls[1][1]).toMatch(UUID);
      expect(crear.mock.calls[1][1]).not.toBe(crear.mock.calls[0][1]);
    },
  );

  it.each([
    [
      'la tasa',
      () => escribirTasa('30'),
      { nombre: 'Visa Oro', tasaEA: 0.3, cuotaUnicaSinInteres: false },
    ],
    [
      'el interruptor',
      () => alternar(CUOTA),
      { nombre: 'Visa Oro', tasaEA: 0.24, cuotaUnicaSinInteres: true },
    ],
  ])(
    'CA-RF24-F38 si el primer intento falló y el usuario cambia %s, es una acción nueva con otra clave',
    async (_campo, cambiar, cuerpo) => {
      crearConError(new ApiError(500, 'x'));
      await nuevaLlena('Visa Oro', '24');
      await fireEvent.press(guardar());
      await screen.findByText(TEXTO.errorGuardar);

      await cambiar();
      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(2));
      expect(crear.mock.calls[1][0]).toEqual(cuerpo);
      expect(crear.mock.calls[1][1]).not.toBe(crear.mock.calls[0][1]);
    },
  );

  it('CA-RF24-F39 ante un 401 al guardar la hoja no muestra un aviso de error propio', async () => {
    crearConError(new ApiError(401, 'Sesión inválida o vencida'));
    await nuevaLlena();

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Guardar tarjeta')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorGuardar)).toBeNull();
    expect(interruptor(CUOTA)).toBeOnTheScreen();
  });
});

function crearConError(error: Error) {
  crear.mockRejectedValueOnce(error);
}
