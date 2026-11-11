import { GraficaLinea } from '@/components/graficas/grafica-linea';
import { render, screen } from '@testing-library/react-native';

// La librería de gráficas se simula en el borde del módulo: se verifica lo que el componente le entrega.
const mockLineChart = jest.fn((_props: any) => null);
let mockModo: 'light' | 'dark' = 'light';
let mockAnchoPantalla = 360;

jest.mock('react-native-gifted-charts', () => ({
  LineChart: (props: any) => mockLineChart(props),
}));
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockModo }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockAnchoPantalla, height: 800, scale: 1, fontScale: 1 }),
}));

const DESCRIPCION = 'Egresos por mes, de enero a junio';
const MESES = [
  { etiqueta: 'Ene', valor: 1200000 },
  { etiqueta: 'Feb', valor: 950000 },
  { etiqueta: 'Mar', valor: 1800000 },
];

const props = () => mockLineChart.mock.calls[mockLineChart.mock.calls.length - 1][0];

async function mostrar(datos = MESES) {
  await render(<GraficaLinea datos={datos} descripcion={DESCRIPCION} />);
}

beforeEach(() => {
  mockLineChart.mockClear();
  mockModo = 'light';
  mockAnchoPantalla = 360;
});

describe('GraficaLinea', () => {
  it('CA-RF19-01 se anuncia como imagen con su descripción', async () => {
    await mostrar();
    expect(screen.getByRole('image', { name: DESCRIPCION })).toBeOnTheScreen();
  });

  it('CA-RF19-02 entrega un punto por dato, en orden, con su etiqueta y su valor', async () => {
    await mostrar();
    expect(props().data).toEqual([
      expect.objectContaining({ label: 'Ene', value: 1200000 }),
      expect.objectContaining({ label: 'Feb', value: 950000 }),
      expect.objectContaining({ label: 'Mar', value: 1800000 }),
    ]);
  });

  it('CA-RF19-03 escribe el eje vertical en pesos con puntos y sin decimales', async () => {
    await mostrar();
    expect(props().formatYLabel(2100000)).toBe('$2.100.000');
    expect(props().formatYLabel('2100000')).toBe('$2.100.000');
    expect(props().formatYLabel(1234.6)).toBe('$1.235');
  });

  it('CA-RF19-04 cabe en una pantalla de celular y no pasa de 640 px en escritorio', async () => {
    mockAnchoPantalla = 360;
    await mostrar();
    expect(props().width + props().yAxisLabelWidth).toBe(360 - 48);

    mockAnchoPantalla = 1280;
    await mostrar();
    expect(props().width + props().yAxisLabelWidth).toBe(640);
  });

  it('CA-RF19-05 usa los colores del modo claro y del oscuro', async () => {
    await mostrar();
    expect(props().color).toBe('#FFD300');
    expect(props().dataPointsColor).toBe('#FFD300');
    expect(props().xAxisLabelTextStyle.color).toBe('#757B81');
    expect(props().yAxisTextStyle.color).toBe('#757B81');
    expect(props().rulesColor).toBe('#E3E4E6');

    mockModo = 'dark';
    await mostrar();
    expect(props().color).toBe('#FFD300');
    expect(props().dataPointsColor).toBe('#FFD300');
    expect(props().xAxisLabelTextStyle.color).toBe('#A6A9AE');
    expect(props().yAxisTextStyle.color).toBe('#A6A9AE');
    expect(props().rulesColor).toBe('#262B32');
  });

  it('CA-RF19-06 con un solo punto lo muestra con su etiqueta y su valor', async () => {
    await mostrar([{ etiqueta: 'Ene', valor: 1200000 }]);
    expect(props().data).toEqual([expect.objectContaining({ label: 'Ene', value: 1200000 })]);
    expect(screen.getByRole('image', { name: DESCRIPCION })).toBeOnTheScreen();
  });

  it('CA-RF19-07 con todos los valores en cero muestra etiquetas y $0 sin NaN', async () => {
    await mostrar([
      { etiqueta: 'Ene', valor: 0 },
      { etiqueta: 'Feb', valor: 0 },
    ]);
    expect(props().data.map((d: any) => d.label)).toEqual(['Ene', 'Feb']);
    expect(props().formatYLabel(0)).toBe('$0');
    expect(props().formatYLabel('0')).toBe('$0');
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF19-08 sin datos no se rompe y conserva la etiqueta de accesibilidad', async () => {
    await mostrar([]);
    expect(screen.getByRole('image', { name: DESCRIPCION })).toBeOnTheScreen();
    expect(props().data).toEqual([]);
    const numeros = Object.values(props()).filter((v) => typeof v === 'number') as number[];
    expect(numeros.every(Number.isFinite)).toBe(true);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
