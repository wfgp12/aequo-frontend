import RootLayout from '@/app/_layout';
import { render, screen } from '@testing-library/react-native';

let mockEstado = 'cargando';

jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/session', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ estado: mockEstado }),
}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => (
    <>
      <Text>pila</Text>
      {children}
    </>
  );
  Stack.Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) =>
    guard ? children : null;
  Stack.Screen = ({ name }: { name: string }) => <Text>pantalla {name}</Text>;
  return { ErrorBoundary: () => null, Stack };
});

describe('RootLayout', () => {
  it('muestra solo un indicador de carga mientras lee la sesión guardada', async () => {
    mockEstado = 'cargando';
    await render(<RootLayout />);
    expect(screen.queryByText('pila')).toBeNull();
  });

  it('con sesión activa expone la vista principal y no el login', async () => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla index')).toBeOnTheScreen();
    expect(screen.queryByText('pantalla login')).toBeNull();
  });

  it('sin sesión expone el login y no la vista principal', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla login')).toBeOnTheScreen();
    expect(screen.queryByText('pantalla index')).toBeNull();
  });
});
