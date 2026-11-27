import RootLayout from '@/app/_layout';
import Home from '@/app/index';
import { fireEvent, render, screen } from '@testing-library/react-native';

// Llegar a "Mis categorías": el botón del inicio y la ruta protegida
// (criterios/02-categorias-gestion.md, CA-RF11-F01 y F02). Mismo armado que home.test.tsx y layout.test.tsx.
let mockEstado = 'activa';
const mockIr = jest.fn();

jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/session', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ estado: mockEstado, sesion: { usuario: { nombre: 'Ana' } } }),
}));
jest.mock('expo-router', () => {
  const { cloneElement } = require('react');
  const { Text } = require('react-native');
  function Stack({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  Stack.Protected = function Protected(p: { guard: boolean; children: React.ReactNode }) {
    return p.guard ? p.children : null;
  };
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <Text>pantalla {name}</Text>;
  };
  return {
    ErrorBoundary: () => null,
    Stack,
    // Como con `asChild`, el Link le da al botón el toque que lleva a su ruta
    Link: ({ children, href }: { children: React.ReactElement<any>; href: unknown }) =>
      cloneElement(children, { onPress: () => mockIr(href) }),
  };
});

beforeEach(() => {
  mockEstado = 'activa';
  mockIr.mockClear();
});

describe('Llegar a "Mis categorías"', () => {
  it('CA-RF11-F01 el inicio ofrece el botón "Mis categorías", que lleva a /categorias', async () => {
    await render(<Home />);

    await fireEvent.press(screen.getByRole('button', { name: 'Mis categorías' }));

    expect(mockIr).toHaveBeenCalledWith('/categorias');
  });

  it('CA-RF11-F02 con sesión activa la pantalla de categorías está disponible', async () => {
    await render(<RootLayout />);

    expect(screen.getByText(/^pantalla categorias(\/index)?$/)).toBeOnTheScreen();
  });

  it('CA-RF11-F02 sin sesión la pantalla de categorías no está disponible', async () => {
    mockEstado = 'sin-sesion';

    await render(<RootLayout />);

    expect(screen.queryByText(/^pantalla categorias/)).toBeNull();
    expect(screen.getByText('pantalla login')).toBeOnTheScreen();
  });
});
