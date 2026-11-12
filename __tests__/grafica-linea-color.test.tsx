import { GraficaLinea } from '@/components/graficas/grafica-linea';
import { render } from '@testing-library/react-native';

// Lo nuevo de GraficaLinea para la tarjeta "Evolución del balance" (criterios/03-reportes-evolucion.md):
// color propio (CA-RF19-30) y margenExtra (CA-RF19-36). La librería de gráficas se simula en su borde.
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

const DATOS = [
  { etiqueta: 'abr', valor: 1200000 },
  { etiqueta: 'may', valor: -300000 },
];
const props = () => mockLineChart.mock.calls[mockLineChart.mock.calls.length - 1][0];

beforeEach(() => {
  mockLineChart.mockClear();
  mockModo = 'light';
  mockAnchoPantalla = 360;
});

describe('GraficaLinea: color propio', () => {
  it('CA-RF19-30 con color, la línea y los puntos lo usan y los ejes conservan sus grises', async () => {
    await render(<GraficaLinea datos={DATOS} descripcion="x" color="#262B32" />);

    expect(props().color).toBe('#262B32');
    expect(props().dataPointsColor).toBe('#262B32');
    expect(props().xAxisLabelTextStyle.color).toBe('#757B81');
    expect(props().yAxisTextStyle.color).toBe('#757B81');
    expect(props().rulesColor).toBe('#E3E4E6');
  });

  it('CA-RF19-30 en modo oscuro con color blanco, los ejes usan los grises del modo oscuro', async () => {
    mockModo = 'dark';

    await render(<GraficaLinea datos={DATOS} descripcion="x" color="#FFFFFF" />);

    expect(props().color).toBe('#FFFFFF');
    expect(props().dataPointsColor).toBe('#FFFFFF');
    expect(props().xAxisLabelTextStyle.color).toBe('#A6A9AE');
    expect(props().yAxisTextStyle.color).toBe('#A6A9AE');
    expect(props().rulesColor).toBe('#262B32');
  });

  it('CA-RF19-30 sin color propio sigue en amarillo, en claro y en oscuro', async () => {
    await render(<GraficaLinea datos={DATOS} descripcion="x" />);
    expect(props().color).toBe('#FFD300');
    expect(props().dataPointsColor).toBe('#FFD300');

    mockModo = 'dark';
    await render(<GraficaLinea datos={DATOS} descripcion="x" />);
    expect(props().color).toBe('#FFD300');
    expect(props().dataPointsColor).toBe('#FFD300');
  });
});

describe('GraficaLinea: margenExtra', () => {
  it('CA-RF19-36 con margenExtra 34 en una pantalla de 360 px el ancho es 206', async () => {
    await render(<GraficaLinea datos={DATOS} descripcion="x" margenExtra={34} />);

    expect(props().width).toBe(206);
    expect(props().yAxisLabelWidth).toBe(72);
  });

  it('CA-RF19-36 en 1280 px no pasa del tope de 640 antes de descontar el eje', async () => {
    mockAnchoPantalla = 1280;

    await render(<GraficaLinea datos={DATOS} descripcion="x" margenExtra={34} />);

    expect(props().width + props().yAxisLabelWidth).toBe(640);
  });

  it('CA-RF19-36 sin margenExtra el ancho no cambia respecto de 3.2.1', async () => {
    await render(<GraficaLinea datos={DATOS} descripcion="x" />);

    expect(props().width + props().yAxisLabelWidth).toBe(360 - 48);
  });
});
