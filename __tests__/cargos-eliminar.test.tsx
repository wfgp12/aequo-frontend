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
  conCodigo,
  desconocido,
  errorHttp,
  MENSAJE_Y_ACCION,
  rutaNoEncontrada,
} from './ayudas/errores';
import {
  boton,
  gestoAtras,
  pendiente,
  RED,
  TECNICO,
  textoDePantalla,
  VER_TODO,
} from './ayudas/tarjetas';

// Eliminar un cargo fijo con confirmación (criterios/05-tarjetas-pantallas.md, CA-RF29-F32 a F38). Mientras el
// diálogo está abierto, la hoja y la lista quedan detrás: se miran con VER_TODO.
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
  dialogo: '¿Eliminar este cargo fijo?',
  detalle: 'Netflix · $ 45.000 al mes. Esta acción no se puede deshacer.',
  errorEliminar: 'No pudimos eliminar el cargo fijo. Inténtalo de nuevo en unos minutos.',
};

let servidor: ReturnType<typeof crearServidorDeCargos>;

const dialogoAbierto = () => screen.queryByText(TEXTO.dialogo) !== null;
const hojaAbierta = () => screen.queryByText('Editar cargo fijo', VER_TODO) !== null;
const hayNetflix = () =>
  screen.queryByRole('button', { name: 'Netflix, $ 45.000 al mes', ...VER_TODO }) !== null;

async function abrirDialogo(cargos: CargoFijo[] = [NETFLIX, SPOTIFY, GIMNASIO]) {
  servidor = crearServidorDeCargos(cargos);
  listar.mockImplementation(async () => servidor.listar());
  eliminar.mockImplementation(async (tarjetaId, id) => servidor.eliminar(tarjetaId, id));
  await render(<Cargos />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Netflix, $ 45.000 al mes' }));
  await screen.findByText('Editar cargo fijo');
  await fireEvent.press(boton('Eliminar cargo fijo'));
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

describe('Eliminar un cargo fijo: confirmación', () => {
  it('CA-RF29-F32 "Eliminar cargo fijo" pide confirmar con su texto y todavía no elimina nada', async () => {
    await abrirDialogo();

    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.detalle)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('CA-RF29-F33 "Cancelar" cierra el diálogo sin eliminar y la hoja sigue abierta con sus datos', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Cancelar'));

    await sinDialogo();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Editar cargo fijo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Descripción')).toHaveDisplayValue('Netflix');
  });

  it('CA-RF29-F33 el gesto "atrás" también cierra el diálogo sin eliminar', async () => {
    await abrirDialogo();

    await gestoAtras();

    await sinDialogo();
    expect(eliminar).not.toHaveBeenCalled();
    expect(screen.getByText('Editar cargo fijo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Descripción')).toHaveDisplayValue('Netflix');
  });
});

describe('Eliminar un cargo fijo: confirmar', () => {
  it('CA-RF29-F34 confirmar elimina una sola vez, cierra diálogo y hoja, vuelve a pedir la lista y el cargo ya no aparece', async () => {
    await abrirDialogo();

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(eliminar).toHaveBeenCalledWith(VISA_ID, NETFLIX.id);
    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hayNetflix()).toBe(false));
    expect(screen.getByText(/Spotify/)).toBeOnTheScreen();
  });

  it('CA-RF29-F34 si era el último cargo, la lista muestra el aviso de vacío', async () => {
    await abrirDialogo([NETFLIX]);

    await fireEvent.press(boton('Eliminar'));

    expect(
      await screen.findByText(
        'Esta tarjeta no tiene cargos fijos. Agrega los que te cobran cada mes, como una suscripción.',
      ),
    ).toBeOnTheScreen();
    expect(hayNetflix()).toBe(false);
  });

  it('CA-RF29-F35 mientras elimina, "Eliminar" muestra un indicador, los dos botones no se pueden tocar y un doble toque no repite', async () => {
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

describe('Eliminar un cargo fijo: cuando algo falla', () => {
  it('CA-RF29-F36 si el cargo ya estaba eliminado (404) cierra diálogo y hoja y deja de mostrarlo, sin aviso de error', async () => {
    await abrirDialogo();
    eliminar.mockImplementationOnce(async () => {
      servidor.items = servidor.items.filter((c) => c.id !== NETFLIX.id);
      throw new ApiError(404, 'Cargo fijo no encontrado');
    });

    await fireEvent.press(boton('Eliminar'));

    await sinDialogo();
    await sinHoja();
    await waitFor(() => expect(hayNetflix()).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorEliminar)).toBeNull();
  });

  it('CA-RF29-F37 sin conexión avisa dentro del diálogo, "Eliminar" vuelve a estar disponible y el cargo sigue', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new NetworkError());

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByText(RED)).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeEnabled();
    expect(boton('Cancelar')).toBeEnabled();
    expect(hayNetflix()).toBe(true);
  });

  it.each([400, 500])(
    'CA-RF29-F37 ante un %s avisa dentro del diálogo, deja reintentar y el cargo sigue',
    async (status) => {
      await abrirDialogo();
      eliminar.mockRejectedValueOnce(new ApiError(status, 'x'));

      await fireEvent.press(boton('Eliminar'));

      expect(await screen.findByText(TEXTO.errorEliminar)).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorEliminar);
      expect(screen.getByText(TEXTO.dialogo)).toBeOnTheScreen();
      expect(boton('Eliminar')).toBeEnabled();
      expect(hayNetflix()).toBe(true);

      await fireEvent.press(boton('Eliminar'));

      await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(2));
      await sinDialogo();
      await waitFor(() => expect(hayNetflix()).toBe(false));
    },
  );

  it('CA-RF29-F38 ante un 401 el diálogo no muestra un aviso de error propio', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new ApiError(401, 'Sesión inválida o vencida'));

    await fireEvent.press(boton('Eliminar'));

    await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Eliminar')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO.errorEliminar)).toBeNull();
  });
});

describe('Eliminar un cargo fijo: accesibilidad y lenguaje (RNF-04, RNF-06)', () => {
  it('CA-RF29-F39 el diálogo se anuncia con su nombre y sus botones "Cancelar" y "Eliminar"', async () => {
    await abrirDialogo();

    expect(screen.getByLabelText(TEXTO.dialogo)).toBeOnTheScreen();
    expect(boton('Cancelar')).toBeOnTheScreen();
    expect(boton('Eliminar')).toBeOnTheScreen();
  });

  it('CA-RF29-F40 el diálogo y sus avisos no usan términos técnicos ni contables', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(new ApiError(500, 'Internal server error'));
    await fireEvent.press(boton('Eliminar'));
    await screen.findByText(TEXTO.errorEliminar);

    const texto = textoDePantalla();
    expect(texto).not.toMatch(TECNICO);
    expect(texto).not.toMatch(/recurrente/i);
  });
});

// criterios/08-codigos-de-error.md
describe('Eliminar un cargo fijo: códigos de error', () => {
  it.each(['CARGO_NO_ENCONTRADO', 'TARJETA_NO_ENCONTRADA'])(
    'CA-RNF04-11 con %s el diálogo se cierra sin aviso y la lista ya no lo muestra',
    async (code) => {
      await abrirDialogo();
      eliminar.mockImplementationOnce(async () => {
        servidor.items = servidor.items.filter((c) => c.id !== NETFLIX.id);
        throw conCodigo(404, code);
      });

      await fireEvent.press(boton('Eliminar'));

      await sinDialogo();
      await sinHoja();
      await waitFor(() => expect(hayNetflix()).toBe(false));
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('CA-RNF04-15 una dirección que no existe no da el cargo por eliminado', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(rutaNoEncontrada());

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorEliminar);
    expect(dialogoAbierto()).toBe(true);
    expect(hayNetflix()).toBe(true);
  });

  it('CA-RNF04-17 con ERROR_HTTP muestra el texto general y el cargo sigue', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(errorHttp());

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO.errorEliminar);
    expect(hayNetflix()).toBe(true);
  });

  it('CA-RNF04-18 con un caso sin texto propio muestra el message y el action y el cargo sigue', async () => {
    await abrirDialogo();
    eliminar.mockRejectedValueOnce(desconocido());

    await fireEvent.press(boton('Eliminar'));

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_Y_ACCION);
    expect(dialogoAbierto()).toBe(true);
    expect(hayNetflix()).toBe(true);
  });
});
