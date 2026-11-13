import Tarjetas from '@/app/tarjetas';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AMEX, crearServidorDeTarjetas, VISA } from './ayudas/datos-tarjetas';
import { alternar, boton, estaEncendido, interruptor, volverDeLaHoja } from './ayudas/tarjetas';

// Formulario de la tarjeta (hoja "Nueva tarjeta" / "Editar tarjeta"): qué contiene, cómo se escribe la tasa y
// la validación antes de llamar al backend (criterios/05-tarjetas-pantallas.md, CA-RF24-F14 a F24).
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
  aliasVacio: 'Escribe un alias para tu tarjeta.',
  aliasLargo: 'El alias no puede tener más de 50 caracteres.',
  tasaVacia: 'Escribe la tasa de interés. Si tu tarjeta no cobra intereses, escribe 0.',
  tasaAlta: 'La tasa no puede pasar de 100.',
  nota: 'Si cambias la tasa, aplica solo a las compras nuevas. Las anteriores conservan la que tenían.',
};
const CUOTA = 'Compras a 1 cuota sin intereses';

const campoAlias = () => screen.getByLabelText('Alias');
const campoTasa = () => screen.getByLabelText('Tasa de interés E.A.');
const guardar = () => boton('Guardar tarjeta');
const escribirAlias = (texto: string) => fireEvent.changeText(campoAlias(), texto);
const escribirTasa = (texto: string) => fireEvent.changeText(campoTasa(), texto);

async function mostrar(tarjetas: Tarjeta[] = [VISA, AMEX]) {
  const servidor = crearServidorDeTarjetas(tarjetas);
  listar.mockImplementation(servidor.listar);
  crear.mockImplementation(async (datos) => servidor.crear(datos));
  actualizar.mockImplementation(async (id, cambios) => servidor.actualizar(id, cambios));
  await render(<Tarjetas />);
  await screen.findByRole('button', { name: '+ Agregar tarjeta' });
}
async function abrirNueva() {
  await mostrar();
  await fireEvent.press(boton('+ Agregar tarjeta'));
  await screen.findByText('Nueva tarjeta');
}
async function abrirEdicion(tarjeta: Tarjeta = VISA, tasa = '29,21') {
  await mostrar([tarjeta]);
  await fireEvent.press(boton(`${tarjeta.nombre}, Tasa ${tasa} % E.A.`));
  await screen.findByText('Editar tarjeta');
}
async function llenarNueva(alias = 'Visa Oro', tasa = '24') {
  await abrirNueva();
  await escribirAlias(alias);
  await escribirTasa(tasa);
}
const hojaCerrada = (titulo: string) =>
  waitFor(() => expect(screen.queryByText(titulo)).toBeNull());

beforeEach(() => {
  listar.mockReset().mockResolvedValue([]);
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Formulario de tarjeta: qué contiene', () => {
  it('CA-RF24-F14 "Nueva tarjeta" tiene título, "Volver", "Alias", "Tasa de interés E.A.", el interruptor y "Guardar tarjeta", y nada de editar', async () => {
    await abrirNueva();

    expect(screen.getByText('Nueva tarjeta')).toBeOnTheScreen();
    expect(volverDeLaHoja('Nueva tarjeta')).toBeOnTheScreen();
    expect(campoAlias().props.placeholder).toBe('Ej: Visa Bancolombia');
    expect(campoTasa().props.placeholder).toBe('Ej: 24%');
    expect(interruptor(CUOTA)).toBeOnTheScreen();
    expect(guardar()).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cargos fijos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar tarjeta' })).toBeNull();
    expect(screen.queryByText(TEXTO.nota)).toBeNull();
    expect(screen.queryByText(/Cupo total|Día de corte|Día de pago/)).toBeNull();
  });

  it('CA-RF24-F14 "Editar tarjeta" suma "Cargos fijos", "Eliminar tarjeta" y la nota sobre la tasa', async () => {
    await abrirEdicion();

    expect(screen.getByText('Editar tarjeta')).toBeOnTheScreen();
    expect(volverDeLaHoja('Editar tarjeta')).toBeOnTheScreen();
    expect(campoAlias().props.placeholder).toBe('Ej: Visa Bancolombia');
    expect(campoTasa().props.placeholder).toBe('Ej: 24%');
    expect(interruptor(CUOTA)).toBeOnTheScreen();
    expect(guardar()).toBeOnTheScreen();
    expect(boton('Cargos fijos')).toBeOnTheScreen();
    expect(boton('Eliminar tarjeta')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
    expect(screen.queryByText(/Cupo total|Día de corte|Día de pago/)).toBeNull();
  });

  it.each([
    ['nueva', async () => llenarNueva(), 'Nueva tarjeta'],
    ['de editar', async () => abrirEdicion(), 'Editar tarjeta'],
  ])(
    'CA-RF24-F15 "Volver" cierra la hoja %s sin guardar, aunque haya cambios escritos',
    async (_caso, abrir, titulo) => {
      await abrir();
      await escribirAlias('Cambio sin guardar');

      await fireEvent.press(volverDeLaHoja(titulo));

      await hojaCerrada(titulo);
      expect(crear).not.toHaveBeenCalled();
      expect(actualizar).not.toHaveBeenCalled();
      expect(eliminar).not.toHaveBeenCalled();
    },
  );

  it('CA-RF24-F15 tras "Volver" la lista queda igual', async () => {
    await abrirEdicion();
    await escribirAlias('Cambio sin guardar');
    await fireEvent.press(volverDeLaHoja('Editar tarjeta'));
    await hojaCerrada('Editar tarjeta');

    expect(screen.getByText('Visa Bancolombia')).toBeOnTheScreen();
    expect(screen.getByText('Tasa 29,21 % E.A.')).toBeOnTheScreen();
  });
});

describe('Formulario de tarjeta: el campo de la tasa y el interruptor', () => {
  it.each([
    ['29,21', '29,21'],
    ['29.21', '29,21'],
    ['abc29,21', '29,21'],
    ['-5', '5'],
    ['12,555', '12,55'],
    ['12.555', '12,55'],
  ])('CA-RF24-F16 al escribir "%s" el campo muestra "%s"', async (escrito, visto) => {
    await abrirNueva();

    await escribirTasa(escrito);

    expect(campoTasa()).toHaveDisplayValue(visto);
  });

  it('CA-RF24-F16 solo queda un separador decimal', async () => {
    await abrirNueva();
    await escribirTasa('1,2');

    await escribirTasa('1,2,3');

    expect(campoTasa()).toHaveDisplayValue(/^\d+,\d{1,2}$/);
  });

  it('CA-RF24-F17 el interruptor cambia al tocarlo: encendido y, al tocarlo otra vez, apagado', async () => {
    await abrirNueva();
    expect(estaEncendido(CUOTA)).toBe(false);

    await alternar(CUOTA);
    expect(interruptor(CUOTA)).toBeChecked();

    await alternar(CUOTA);
    expect(interruptor(CUOTA)).not.toBeChecked();
  });
});

describe('Formulario de tarjeta: validación antes de llamar al backend', () => {
  it.each([
    ['vacío', ''],
    ['solo con espacios', '   '],
  ])('CA-RF24-F18 un alias %s no se envía y avisa', async (_caso, alias) => {
    await llenarNueva(alias, '24');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.aliasVacio);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F18 al editar, dejar el alias vacío tampoco se envía', async () => {
    await abrirEdicion();
    await escribirAlias('   ');

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.aliasVacio)).toBeOnTheScreen();
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F19 un alias de 51 caracteres no se envía y avisa', async () => {
    await llenarNueva('a'.repeat(51), '24');

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.aliasLargo);
    expect(crear).not.toHaveBeenCalled();
  });

  it('CA-RF24-F19 un alias de 50 caracteres sí se envía', async () => {
    await llenarNueva('a'.repeat(50), '24');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0].nombre).toBe('a'.repeat(50));
    expect(screen.queryByText(TEXTO.aliasLargo)).toBeNull();
  });

  it('CA-RF24-F19 los espacios de los extremos no cuentan para el límite', async () => {
    await llenarNueva(`  ${'a'.repeat(50)}  `, '24');

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(TEXTO.aliasLargo)).toBeNull();
  });

  it.each([
    ['vacía', ''],
    ['solo con una coma', ','],
  ])('CA-RF24-F20 una tasa %s no se envía y avisa', async (_caso, tasa) => {
    await llenarNueva('Visa Oro', tasa);

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.tasaVacia);
    expect(crear).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F20 al editar, dejar la tasa vacía tampoco se envía', async () => {
    await abrirEdicion();
    await escribirTasa('');

    await fireEvent.press(guardar());

    expect(await screen.findByText(TEXTO.tasaVacia)).toBeOnTheScreen();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it.each(['100,01', '150'])('CA-RF24-F21 una tasa de "%s" no se envía y avisa', async (tasa) => {
    await llenarNueva('Visa Oro', tasa);

    await fireEvent.press(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.tasaAlta);
    expect(crear).not.toHaveBeenCalled();
  });

  it.each([
    ['100', 1],
    ['0', 0],
    ['0,0', 0],
  ])('CA-RF24-F21 el extremo válido "%s" sí se envía', async (tasa, enviada) => {
    await llenarNueva('Visa Oro', tasa);

    await fireEvent.press(guardar());

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
    expect(crear.mock.calls[0][0].tasaEA).toBe(enviada);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['el alias', () => escribirAlias('Visa Plata')],
    ['la tasa', () => escribirTasa('30')],
    ['el interruptor', () => alternar(CUOTA)],
  ])('CA-RF24-F22 el aviso de validación desaparece al editar %s', async (_campo, editar) => {
    await llenarNueva('', '24');
    await fireEvent.press(guardar());
    await screen.findByRole('alert');

    await editar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.aliasVacio)).toBeNull();
  });
});

describe('Formulario de tarjeta: la tasa, del porcentaje a la fracción y de vuelta', () => {
  it.each([
    ['24', 0.24],
    ['29,21', 0.2921],
    ['29.21', 0.2921],
    ['12,5', 0.125],
    ['8,3', 0.083],
    ['57', 0.57],
    ['0,07', 0.0007],
    ['0', 0],
    ['100', 1],
  ])(
    'CA-RF24-F23 al escribir "%s" se envía la tasa %s, exacta y como número',
    async (escrito, enviada) => {
      await llenarNueva('Visa Oro', escrito);

      await fireEvent.press(guardar());

      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      const { tasaEA } = crear.mock.calls[0][0];
      expect(tasaEA).toBe(enviada);
      expect(typeof tasaEA).toBe('number');
    },
  );

  it('CA-RF24-F24 la tasa guardada se muestra como porcentaje sin ruido al abrir "Editar tarjeta"', async () => {
    const guardadas: [number, string][] = [
      [0.24, '24'],
      [0.2921, '29,21'],
      [0.125, '12,5'],
      [0.083, '8,3'],
      [0.07, '7'],
      [0.57, '57'],
      [0.0007, '0,07'],
      [0.29213, '29,213'],
      [0, '0'],
      [1, '100'],
    ];
    await mostrar(
      guardadas.map(([tasaEA], i) => ({ ...VISA, id: `t${i}`, nombre: `Tarjeta ${i}`, tasaEA })),
    );

    for (const [i, [, visto]] of guardadas.entries()) {
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^Tarjeta ${i},`) }));
      await screen.findByText('Editar tarjeta');
      expect(campoTasa()).toHaveDisplayValue(visto);
      await fireEvent.press(volverDeLaHoja('Editar tarjeta'));
      await hojaCerrada('Editar tarjeta');
    }
  });

  it('CA-RF24-F24 guardar sin tocar la tasa no la envía (no se reenvía convertida de ida y vuelta)', async () => {
    await abrirEdicion({ ...VISA, tasaEA: 0.07 }, '7');
    await escribirAlias('Visa Oro');

    await fireEvent.press(guardar());

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
    expect(actualizar.mock.calls[0][1]).toEqual({ nombre: 'Visa Oro' });
  });
});
