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
  boton,
  gestoAtras,
  pendiente,
  RED,
  TECNICO,
  textoDePantalla,
  VER_TODO,
} from './ayudas/tarjetas';

// Eliminar una tarjeta con confirmación (criterios/05-tarjetas-pantallas.md, CA-RF24-F40 a F47). Mientras el diálogo
// está abierto, la hoja y la lista quedan detrás: se miran con VER_TODO, igual que en la eliminación de movimientos.
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
  dialogo: '¿Eliminar esta tarjeta?',
  detalle:
    'Visa Bancolombia. Se eliminarán también sus cargos fijos. Esta acción no se puede deshacer.',
  conPagos: 'Esta tarjeta ya tiene pagos registrados y no se puede eliminar.',
  errorEliminar: 'No pudimos eliminar tu tarjeta. Inténtalo de nuevo en unos minutos.',
};

let servidor: ReturnType<typeof crearServidorDeTarjetas>;

const dialogoAbierto = () => screen.queryByText(TEXTO.dialogo) !== null;
const hojaAbierta = () => screen.queryByText('Editar tarjeta', VER_TODO) !== null;
const hayVisa = () => screen.queryByText('Visa Bancolombia', VER_TODO) !== null;

async function abrirDialogo(tarjetas: Tarjeta[] = [VISA, AMEX]) {
  servidor = crearServidorDeTarjetas(tarjetas);
  listar.mockImplementation(servidor.listar);
  eliminar.mockImplementation(async (id) => servidor.eliminar(id));
  await render(<Tarjetas />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Visa Bancolombia, Tasa 29,21 % E.A.' }),
  );
  await screen.findByText('Editar tarjeta');
  await fireEvent.press(boton('Eliminar tarjeta'));
  await screen.findByText(TEXTO.dialogo);
}
const sinDialogo = () => waitFor(() => expect(dialogoAbierto()).toBe(false));
const sinHoja = () => waitFor(() => expect(hojaAbierta()).toBe(false));

beforeEach(() => {
  listar.mockReset().mockResolvedValue([]);
  crear.mockReset();
  actualizar.mockReset();
  eliminar.mockReset();
});

describe('Eliminar una tarjeta: confirmación', () => {
  it('CA-RF24-F40 "Eliminar tarjeta" pide confirmar con su texto y todavía no elimina nada', async () => {
    await abrirDialogo();

    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.detalle)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF24-F41 "Cancelar" cierra el diálogo sin eliminar y la hoja sigue abierta con sus datos', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Cancelar'));

    await sinDialogo();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Editar tarjeta')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alias')).toHaveDisplayValue('Visa Bancolombia');
  });

  it('CA-RF24-F41 el gesto "atrás" también cierra el diálogo sin eliminar', async () => {
    await abrirDialogo();

    await gestoAtras();

    await sinDialogo();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Editar tarjeta')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alias')).toHaveDisplayValue('Visa Bancolombia');
  });
});

describe('Eliminar una tarjeta: confirmar', () => {
  it('CA-RF24-F42 confirmar elimina una sola vez, cierra diálogo y hoja, vuelve a pedir la lista y la tarjeta ya no aparece', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(eliminar).toHaveBeenCalledWith(VISA_ID);
    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hayVisa()).toBe(false));
    expect(screen.getByText('Amex')).toBeOnTheScreen();
  });

  it('CA-RF24-F42 si era la última tarjeta, la lista muestra el aviso de vacío', async () => {
    await abrirDialogo([VISA]);

    await fireEvent.press(boton('Eliminar'));

    expect(
      await screen.findByText('Todavía no tienes tarjetas. Agrega la primera para empezar.'),
    ).toBeOnTheScreen();
    expect(hayVisa()).toBe(false);
  });

  it('CA-RF24-F43 mientras elimina, "Eliminar" muestra un indicador, los dos botones no se pueden tocar y un doble toque no repite', async () => {
    const respuesta = pendiente<void>();
    await abrirDialogo();
    eliminar.mockReturnValueOnce(respuesta.promesa);
    const confirmar = boton('Eliminar');
    const cancelar = boton('Cancelar');

    await fireEvent.press(confirmar);
    await fireEvent.press(confirmar);

    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Eliminar')).toBeNull();
    expect(confirmar).toBeDisabled();
    expect(cancelar).toBeDisabled();
    await act(async () => respuesta.resolver());
    expect(eliminar).toHaveBeenCalledTimes(1);
  });
});

describe('Eliminar una tarjeta: cuando algo falla', () => {
  it('CA-RF24-F44 si la tarjeta tiene pagos registrados (409) lo explica dentro del diálogo y la tarjeta sigue', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar una tarjeta que ya tiene pagos registrados'),
    );

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByText(TEXTO.conPagos)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.conPagos);
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(
      screen.queryByText('No se puede eliminar una tarjeta que ya tiene pagos registrados'),
    ).toBeNull();

    await fireEvent.press(boton('Cancelar'));

    await sinDialogo();
    expect(hayVisa()).toBe(true);
    expect(eliminar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF24-F45 si la tarjeta ya estaba eliminada (404) cierra diálogo y hoja y deja de mostrarla, sin aviso de error', async () => {
    await abrirDialogo();
    eliminar.mockImplementationOnce(async () => {
      servidor.items = servidor.items.filter((t) => t.id !== VISA_ID);
      throw new ApiError(404, 'Tarjeta no encontrada');
    });

    await fireEvent.press(boton('Eliminar'));

    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(hayVisa()).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorEliminar)).toBeNull();
  });

  it('CA-RF24-F46 sin conexión avisa dentro del diálogo, "Eliminar" vuelve a estar disponible y la tarjeta sigue', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new NetworkError());

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeEnabled();
    expect(boton('Cancelar')).toBeEnabled();
    expect(hayVisa()).toBe(true);
  });

  it.each([400, 500])(
    'CA-RF24-F46 ante un %s avisa dentro del diálogo, deja reintentar y la tarjeta sigue',
    async (status) => {
      await abrirDialogo();
      eliminar.mockRejectedValueOnce(new ApiError(status, 'x'));

      await fireEvent.press(boton('Eliminar'));

      expect(await screen.findByText(TEXTO.errorEliminar)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorEliminar);
      expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
      expect(boton('Eliminar')).toBeEnabled();
      expect(hayVisa()).toBe(true);

      await fireEvent.press(boton('Eliminar'));

      await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(2));
      await sinDialogo();
      await waitFor(() => expect(hayVisa()).toBe(false));
    },
  );

  it('CA-RF24-F47 ante un 401 el diálogo no muestra un aviso de error propio', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Eliminar')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorEliminar)).toBeNull();
  });
});

describe('Eliminar una tarjeta: accesibilidad y lenguaje (RNF-04, RNF-06)', () => {
  it('CA-RF24-F49 el diálogo se anuncia con su nombre y sus botones "Cancelar" y "Eliminar"', async () => {
    await abrirDialogo();

    expect(screen.getByLabelText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
  });

  it('CA-RF24-F50 el diálogo y sus avisos no usan términos técnicos ni contables', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(
      new ApiError(409, 'No se puede eliminar una tarjeta que ya tiene pagos registrados'),
    );
    await fireEvent.press(boton('Eliminar'));
    await screen.findByText(TEXTO.conPagos);

    expect(textoDePantalla()).not.toMatch(TECNICO);
  });
});
