import RootLayout from '@/app/_layout';
import DevGraficas from '@/app/dev-graficas';
import { render, screen } from '@testing-library/react-native';

// Las gráficas reales se simulan: aquí solo importa qué pantalla se muestra y con qué datos.
jest.mock('react-native-gifted-charts', () => ({
  BarChart: () => null,
  LineChart: () => null,
  PieChart: (props: any) => (props.centerLabelComponent ? props.centerLabelComponent() : null),
}));
jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/session', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ estado: 'sin-sesion' }),
}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Stack.Protected = ({ guard, children }: { guard: boolean; children: React.ReactNode }) =>
    guard ? children : null;
  Stack.Screen = ({ name }: { name: string }) => <Text>pantalla {name}</Text>;
  return { ErrorBoundary: () => null, Stack };
});

const DESCRIPCION_MESES = 'Egresos por mes, de enero a junio';
const DESCRIPCION_DONA = 'Egresos por categoría del mes';

describe('Pantalla /dev-graficas', () => {
  it('CA-RF17-11 muestra el título y las secciones Barras, Dona y Línea, una debajo de otra', async () => {
    await render(<DevGraficas />);
    expect(screen.getByText('Gráficas de prueba')).toBeOnTheScreen();
    expect(screen.getByText('Barras')).toBeOnTheScreen();
    expect(screen.getByText('Dona')).toBeOnTheScreen();
    expect(screen.getByText('Línea')).toBeOnTheScreen();
    // una gráfica por sección: barras y línea, más la dona
    expect(screen.getAllByRole('image', { name: DESCRIPCION_MESES })).toHaveLength(2);
    expect(screen.getByLabelText(DESCRIPCION_DONA)).toBeOnTheScreen();
  });

  it('CA-RF17-12 usa datos fijos en pesos, sin llamar al backend', async () => {
    const fetchEspia = jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn());
    await render(<DevGraficas />);
    expect(screen.getByText('$2.350.000')).toBeOnTheScreen();
    for (const [categoria, valor] of [
      ['Comida', '$650.000'],
      ['Transporte', '$320.000'],
      ['Arriendo', '$1.200.000'],
      ['Otros', '$180.000'],
    ]) {
      expect(screen.getByText(categoria)).toBeOnTheScreen();
      expect(screen.getByText(valor)).toBeOnTheScreen();
    }
    expect(fetchEspia).not.toHaveBeenCalled();
    fetchEspia.mockRestore();
  });

  describe('registro de la ruta', () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    afterEach(() => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
    });

    it('CA-RF17-13 en desarrollo la ruta está disponible, incluso sin sesión', async () => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = true;
      await render(<RootLayout />);
      expect(screen.getByText('pantalla dev-graficas')).toBeOnTheScreen();
    });

    it('CA-RF17-13 fuera de desarrollo la ruta no está disponible', async () => {
      (globalThis as { __DEV__?: boolean }).__DEV__ = false;
      await render(<RootLayout />);
      expect(screen.queryByText('pantalla dev-graficas')).toBeNull();
      expect(screen.queryByText('Gráficas de prueba')).toBeNull();
    });
  });
});
