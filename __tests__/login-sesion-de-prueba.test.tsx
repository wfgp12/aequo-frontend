import Login from '@/app/login';
import { ApiError, NetworkError } from '@/lib/api/client';
import { sesionDePruebaDisponible } from '@/lib/dev-session';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockIniciarSesion = jest.fn();
const mockIniciarSesionDePrueba = jest.fn();
jest.mock('@/lib/dev-session', () => ({ sesionDePruebaDisponible: jest.fn() }));
jest.mock('@/lib/session', () => ({
  useSession: () => ({
    iniciarSesion: mockIniciarSesion,
    iniciarSesionDePrueba: mockIniciarSesionDePrueba,
  }),
}));

const BOTON = 'Entrar con sesión de prueba';

describe('Login: sesión de prueba', () => {
  beforeEach(() => {
    mockIniciarSesion.mockReset();
    mockIniciarSesionDePrueba.mockReset();
  });

  it('en desarrollo muestra el botón y entra con el usuario de prueba', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    mockIniciarSesionDePrueba.mockResolvedValue(undefined);
    await render(<Login />);

    await fireEvent.press(screen.getByText(BOTON));

    expect(mockIniciarSesionDePrueba).toHaveBeenCalledTimes(1);
    expect(mockIniciarSesion).not.toHaveBeenCalled();
  });

  it('en producción NO muestra el botón', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(false);
    await render(<Login />);

    expect(screen.queryByText(BOTON)).toBeNull();
    expect(screen.getByText('Continuar con Google')).toBeOnTheScreen();
  });

  it('explica qué revisar en el backend cuando responde 404', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    mockIniciarSesionDePrueba.mockRejectedValue(new ApiError(404, 'Not Found'));
    await render(<Login />);

    await fireEvent.press(screen.getByText(BOTON));

    expect(await screen.findByText(/DEV_SESSION_ENABLED=true/)).toBeOnTheScreen();
  });

  it('avisa si no hay conexión con el servidor', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    mockIniciarSesionDePrueba.mockRejectedValue(new NetworkError());
    await render(<Login />);

    await fireEvent.press(screen.getByText(BOTON));

    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
  });

  it('muestra el mensaje general ante cualquier otro fallo', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    mockIniciarSesionDePrueba.mockRejectedValue(new Error('boom'));
    await render(<Login />);

    await fireEvent.press(screen.getByText(BOTON));

    expect(await screen.findByText(/No pudimos iniciar tu sesión/)).toBeOnTheScreen();
  });
});
