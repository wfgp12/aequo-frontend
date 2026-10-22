import Perfil from '@/app/perfil';
import { ApiError } from '@/lib/api/client';
import { eliminarCuenta, obtenerPerfil } from '@/lib/api/usuarios';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockCerrarSesion = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ cerrarSesion: mockCerrarSesion }) }));
jest.mock('@/lib/api/usuarios', () => ({ obtenerPerfil: jest.fn(), eliminarCuenta: jest.fn() }));

const ana = { id: 'u1', nombre: 'Ana Prueba', email: 'ana@correo.com', fotoUrl: null };
const CAMPO = 'Escribe ELIMINAR para confirmar';

async function abrirDialogo() {
  await render(<Perfil />);
  await fireEvent.press(await screen.findByText('Eliminar mi cuenta'));
}

async function confirmar() {
  await fireEvent.changeText(screen.getByLabelText(CAMPO), 'ELIMINAR');
  await fireEvent.press(screen.getByText('Eliminar cuenta'));
}

describe('Perfil: eliminar la cuenta', () => {
  beforeEach(() => {
    mockCerrarSesion.mockReset().mockResolvedValue(undefined);
    jest.mocked(obtenerPerfil).mockReset().mockResolvedValue(ana);
    jest.mocked(eliminarCuenta).mockReset();
  });

  it('muestra la zona de peligro y no pide confirmar hasta tocar el botón', async () => {
    await render(<Perfil />);

    expect(await screen.findByText('Zona de peligro')).toBeOnTheScreen();
    expect(screen.getByText('Eliminar mi cuenta')).toBeOnTheScreen();
    expect(screen.queryByText('¿Eliminar tu cuenta?')).toBeNull();
  });

  it('el botón abre el diálogo de confirmación sin eliminar nada', async () => {
    await abrirDialogo();

    expect(screen.getByText('¿Eliminar tu cuenta?')).toBeOnTheScreen();
    expect(eliminarCuenta).not.toHaveBeenCalled();
  });

  it('cancelar cierra el diálogo sin eliminar ni cerrar la sesión', async () => {
    await abrirDialogo();

    await fireEvent.press(screen.getByText('Cancelar'));

    expect(screen.queryByText('¿Eliminar tu cuenta?')).toBeNull();
    expect(eliminarCuenta).not.toHaveBeenCalled();
    expect(mockCerrarSesion).not.toHaveBeenCalled();
  });

  it('al confirmar elimina la cuenta y después cierra la sesión local', async () => {
    jest.mocked(eliminarCuenta).mockResolvedValue(undefined);
    await abrirDialogo();

    await confirmar();

    expect(eliminarCuenta).toHaveBeenCalledTimes(1);
    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('si la eliminación falla avisa, deja abierto el diálogo y NO cierra la sesión', async () => {
    jest.mocked(eliminarCuenta).mockRejectedValue(new ApiError(500, 'error'));
    await abrirDialogo();

    await confirmar();

    expect(await screen.findByText(/No pudimos eliminar tu cuenta\./)).toBeOnTheScreen();
    expect(screen.getByText('¿Eliminar tu cuenta?')).toBeOnTheScreen();
    expect(mockCerrarSesion).not.toHaveBeenCalled();
  });

  it('tras un fallo se puede reintentar la misma petición', async () => {
    jest.mocked(eliminarCuenta).mockRejectedValueOnce(new ApiError(500, 'error'));
    jest.mocked(eliminarCuenta).mockResolvedValueOnce(undefined);
    await abrirDialogo();
    await confirmar();
    await screen.findByText(/No pudimos eliminar tu cuenta\./);

    await fireEvent.press(screen.getByText('Eliminar cuenta'));

    expect(eliminarCuenta).toHaveBeenCalledTimes(2);
    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('si el backend responde 401 no muestra error: la sesión ya se cerró', async () => {
    jest.mocked(eliminarCuenta).mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));
    await abrirDialogo();

    await confirmar();

    expect(screen.queryByText(/No pudimos eliminar tu cuenta\./)).toBeNull();
  });
});
