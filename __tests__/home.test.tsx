import Home from '@/app/index';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/session', () => ({
  useSession: () => ({ sesion: { usuario: { nombre: 'Ana' } } }),
}));

describe('Home', () => {
  it('saluda al usuario con la sesión activa', async () => {
    await render(<Home />);
    expect(screen.getByText('Aequo')).toBeOnTheScreen();
    expect(screen.getByText('Hola, Ana')).toBeOnTheScreen();
  });

  it('ofrece el acceso al perfil', async () => {
    await render(<Home />);
    expect(screen.getByText('Mi perfil')).toBeOnTheScreen();
  });
});
