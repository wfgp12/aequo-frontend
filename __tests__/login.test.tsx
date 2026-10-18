import Login from '@/app/login';
import { ApiError, NetworkError } from '@/lib/api/client';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockIniciarSesion = jest.fn();
jest.mock('@/lib/session', () => ({ useSession: () => ({ iniciarSesion: mockIniciarSesion }) }));

describe('Login', () => {
  beforeEach(() => mockIniciarSesion.mockReset());

  it('muestra los textos del diseño: lema y aviso de datos', async () => {
    await render(<Login />);
    expect(screen.getByText('Aequo')).toBeOnTheScreen();
    expect(screen.getByText('Tus finanzas claras, sin hojas de cálculo.')).toBeOnTheScreen();
    expect(screen.getByText('Al continuar aceptas el tratamiento de tus datos.')).toBeOnTheScreen();
  });

  it('ofrece continuar con Google y llama a iniciarSesion', async () => {
    mockIniciarSesion.mockResolvedValue(true);
    await render(<Login />);
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(mockIniciarSesion).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avisa en lenguaje sencillo si no se pudo verificar la cuenta (401)', async () => {
    mockIniciarSesion.mockRejectedValue(new ApiError(401, 'ID Token inválido o vencido'));
    await render(<Login />);
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(
      await screen.findByText('No pudimos verificar tu cuenta. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
  });

  it('avisa si no hay conexión con el servidor', async () => {
    mockIniciarSesion.mockRejectedValue(new NetworkError());
    await render(<Login />);
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(await screen.findByText(/No hay conexión con el servidor/)).toBeOnTheScreen();
  });

  it('muestra un mensaje general ante cualquier otro fallo', async () => {
    mockIniciarSesion.mockRejectedValue(new Error('boom'));
    await render(<Login />);
    await fireEvent.press(screen.getByText('Continuar con Google'));
    expect(await screen.findByText(/No pudimos iniciar tu sesión/)).toBeOnTheScreen();
  });
});
