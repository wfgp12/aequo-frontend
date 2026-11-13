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

  it('CA-RF20-02 con sesión activa la pantalla de reportes está disponible', async () => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla reportes')).toBeOnTheScreen();
  });

  it('CA-RF20-02 sin sesión la pantalla de reportes no está disponible', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.queryByText('pantalla reportes')).toBeNull();
  });

  it('CA-RF21-F02 con sesión activa la pantalla de la meta de ahorro está disponible', async () => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla meta-de-ahorro')).toBeOnTheScreen();
  });

  it('CA-RF21-F02 sin sesión la pantalla de la meta de ahorro no está disponible', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.queryByText('pantalla meta-de-ahorro')).toBeNull();
  });

  it('CA-RF24-F02 con sesión activa la lista de tarjetas y los cargos fijos de una tarjeta están disponibles', async () => {
    mockEstado = 'activa';
    await render(<RootLayout />);
    expect(screen.getByText(/^pantalla tarjetas(\/index)?$/)).toBeOnTheScreen();
    expect(screen.getByText('pantalla tarjetas/[id]/cargos')).toBeOnTheScreen();
  });

  it('CA-RF24-F02 sin sesión ni la lista de tarjetas ni los cargos fijos están disponibles', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.queryByText(/^pantalla tarjetas/)).toBeNull();
  });

  it('sin sesión expone el login y no la vista principal', async () => {
    mockEstado = 'sin-sesion';
    await render(<RootLayout />);
    expect(screen.getByText('pantalla login')).toBeOnTheScreen();
    expect(screen.queryByText('pantalla index')).toBeNull();
  });
});
