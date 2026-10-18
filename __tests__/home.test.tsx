import Home from '@/app/index';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockCerrarSesion = jest.fn();
jest.mock('@/lib/session', () => ({
  useSession: () => ({
    sesion: { usuario: { nombre: 'Ana' } },
    cerrarSesion: mockCerrarSesion,
  }),
}));

describe('Home', () => {
  it('saluda al usuario con la sesión activa', async () => {
    await render(<Home />);
    expect(screen.getByText('Aequo')).toBeOnTheScreen();
    expect(screen.getByText('Hola, Ana')).toBeOnTheScreen();
  });

  it('cierra la sesión desde el botón', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });
});
