import { ApiError, NetworkError } from '@/lib/api/client';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  obtenerProyeccion,
  obtenerTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AMEX, crearServidorDeTarjetas, VISA, VISA_ID } from './ayudas/datos-tarjetas';
import { mostrarDetalle } from './ayudas/detalle-tarjeta';
import {
  boton,
  gestoAtras,
  pendiente,
  RED,
  TECNICO,
  textoDePantalla,
  VER_TODO,
} from './ayudas/tarjetas';

// Eliminar una tarjeta con confirmación (criterios/05-tarjetas-pantallas.md, CA-RF24-F40 a F47), desde el detalle
// de la tarjeta: al terminar, la app regresa a "Mis tarjetas" (criterios/05-detalle-de-tarjeta.md, CA-RF30-F26).
// Mientras el diálogo está abierto, la hoja y el detalle quedan detrás: se miran con VER_TODO, igual que en la
// eliminación de movimientos.
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => require('./ayudas/router-simulado').parametros,
  useFocusEffect: require('./ayudas/router-simulado').useFocusEffectSimulado,
}));
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  obtenerTarjeta: jest.fn(),
  obtenerProyeccion: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
  listarPagos: jest.fn(),
  registrarPago: jest.fn(),
  eliminarPago: jest.fn(),
}));

const listar = jest.mocked(listarTarjetas);
const crear = jest.mocked(crearTarjeta);
const actualizar = jest.mocked(actualizarTarjeta);
const eliminar = jest.mocked(eliminarTarjeta);

const TEXTO = {
  dialogo: '¿Eliminar esta tarjeta?',
  detalle:
    'Visa Bancolombia. Se eliminarán también sus cargos fijos. Esta acción no se puede deshacer.',
  conPagos: 'Esta tarjeta ya tiene compras o pagos registrados y no se puede eliminar.',
  errorEliminar: 'No pudimos eliminar tu tarjeta. Inténtalo de nuevo en unos minutos.',
};

let servidor: ReturnType<typeof crearServidorDeTarjetas>;

const dialogoAbierto = () => screen.queryByText(TEXTO.dialogo) !== null;
// El campo "Alias" solo está en la hoja: el título "Editar tarjeta" también lo dice el botón del detalle
const hojaAbierta = () => screen.queryByLabelText('Alias', VER_TODO) !== null;
const hayVisa = () => screen.queryByText('Visa Bancolombia', VER_TODO) !== null;

async function abrirDialogo(tarjetas: Tarjeta[] = [VISA, AMEX]) {
  servidor = crearServidorDeTarjetas(tarjetas);
  eliminar.mockImplementation(async (id) => servidor.eliminar(id));
  await mostrarDetalle({ servidor });
  await fireEvent.press(boton('Editar tarjeta'));
  await screen.findByText('Guardar tarjeta');
  await fireEvent.press(boton('Eliminar tarjeta'));
  await screen.findByText(TEXTO.dialogo);
}
const sinDialogo = () => waitFor(() => expect(dialogoAbierto()).toBe(false));
const sinHoja = () => waitFor(() => expect(hojaAbierta()).toBe(false));

beforeEach(() => {
  mockBack.mockReset();
  listar.mockReset().mockResolvedValue([]);
  jest.mocked(obtenerTarjeta).mockReset();
  jest.mocked(obtenerProyeccion).mockReset();
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
    expect(screen.getByLabelText('Alias')).toHaveDisplayValue('Visa Bancolombia');
  });

  it('CA-RF24-F41 el gesto "atrás" también cierra el diálogo sin eliminar', async () => {
    await abrirDialogo();

    await gestoAtras();

    await sinDialogo();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Alias')).toHaveDisplayValue('Visa Bancolombia');
  });
});

describe('Eliminar una tarjeta: confirmar', () => {
  it('CA-RF24-F42 confirmar elimina una sola vez, cierra diálogo y hoja y regresa a "Mis tarjetas" sin volver a pedir nada', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(eliminar).toHaveBeenCalledWith(VISA_ID);
    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(obtenerTarjeta).toHaveBeenCalledTimes(1);
    expect(obtenerProyeccion).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Esta tarjeta ya no existe.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
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
      new ApiError(409, 'No se puede eliminar una tarjeta que ya tiene compras registradas'),
    );

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByText(TEXTO.conPagos)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.conPagos);
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(
      screen.queryByText('No se puede eliminar una tarjeta que ya tiene compras registradas'),
    ).toBeNull();

    await fireEvent.press(boton('Cancelar'));

    await sinDialogo();
    expect(hayVisa()).toBe(true);
    expect(eliminar).toHaveBeenCalledTimes(1);
  });

  it('CA-RF24-F45 si la tarjeta ya estaba eliminada (404) cierra diálogo y hoja y regresa a "Mis tarjetas", sin aviso de error', async () => {
    await abrirDialogo();
    eliminar.mockImplementationOnce(async () => {
      servidor.items = servidor.items.filter((t) => t.id !== VISA_ID);
      throw new ApiError(404, 'Tarjeta no encontrada');
    });

    await fireEvent.press(boton('Eliminar'));

    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(obtenerTarjeta).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorEliminar)).toBeNull();
    expect(screen.queryByText('Esta tarjeta ya no existe.')).toBeNull();
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
      await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
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
      new ApiError(409, 'No se puede eliminar una tarjeta que ya tiene compras registradas'),
    );
    await fireEvent.press(boton('Eliminar'));
    await screen.findByText(TEXTO.conPagos);

    expect(textoDePantalla()).not.toMatch(TECNICO);
  });
});
