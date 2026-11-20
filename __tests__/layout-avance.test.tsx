import RootLayout from '@/app/_layout';
import { render, screen } from '@testing-library/react-native';

// La ruta del avance en efectivo solo existe con sesión (criterios/05-compra-con-tarjeta.md, CA-RF28-F02).
// Mismo armado que layout.test.tsx.
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

describe('RootLayout: avance en efectivo', () => {
  it('CA-RF28-F02 con sesión activa la pantalla del avance en efectivo está disponible', async () => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla avance-en-efectivo')).toBeOnTheScreen();
  });

  it('CA-RF28-F02 sin sesión la pantalla del avance en efectivo no está disponible', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.queryByText('pantalla avance-en-efectivo')).toBeNull();
    expect(screen.getByText('pantalla login')).toBeOnTheScreen();
  });

  it('CA-RF28-F02 mientras se lee la sesión guardada tampoco se arma la pantalla del avance', async () => {
    mockEstado = 'cargando';
    await render(<RootLayout />);
    expect(screen.queryByText('pantalla avance-en-efectivo')).toBeNull();
  });
});
