import RootLayout from '@/app/_layout';
import { render, screen } from '@testing-library/react-native';

// Las rutas de préstamos solo existen con sesión (criterios/06-prestamos.md, CA-RF34-F02).
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
  Stack.Protected = function Protegida(p: { guard: boolean; children: React.ReactNode }) {
    return p.guard ? p.children : null;
  };
  Stack.Screen = function Pantalla({ name }: { name: string }) {
    return <Text>pantalla {name}</Text>;
  };
  return { ErrorBoundary: () => null, Stack };
});

const RUTAS: [string, RegExp][] = [
  ['/prestamos', /^pantalla prestamos(\/index)?$/],
  ['/prestamos/[id]', /^pantalla prestamos\/\[id\](\/index)?$/],
  ['/registrar-prestamo', /^pantalla registrar-prestamo$/],
];

describe('RootLayout: préstamos', () => {
  it.each(RUTAS)('CA-RF34-F02 con sesión activa %s está disponible', async (_ruta, pantalla) => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText(pantalla)).toBeOnTheScreen();
  });

  it.each(RUTAS)('CA-RF34-F02 sin sesión %s no está disponible', async (_ruta, pantalla) => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.queryByText(pantalla)).toBeNull();
    expect(screen.getByText('pantalla login')).toBeOnTheScreen();
  });
});
