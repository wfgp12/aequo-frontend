import { GraficaDona } from '@/components/graficas/grafica-dona';
import { render, screen } from '@testing-library/react-native';

// La librería de gráficas se simula en el borde del módulo. El mock dibuja el texto del centro,
// igual que lo haría la librería, para poder verificar lo que ve la persona.
const mockPieChart = jest.fn((_props: any) => null);
let mockModo: 'light' | 'dark' = 'light';

jest.mock('react-native-gifted-charts', () => ({
  PieChart: (props: any) => {
    mockPieChart(props);
    return props.centerLabelComponent ? props.centerLabelComponent() : null;
  },
}));
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockModo }),
}));

const DESCRIPCION = 'Egresos por categoría del mes';
const CATEGORIAS = [
  { etiqueta: 'Comida', valor: 650000 },
  { etiqueta: 'Transporte', valor: 320000 },
  { etiqueta: 'Arriendo', valor: 1200000 },
  { etiqueta: 'Otros', valor: 180000 },
];

const props = () => mockPieChart.mock.calls[mockPieChart.mock.calls.length - 1][0];

async function mostrar(datos = CATEGORIAS, centro?: string) {
  await render(<GraficaDona datos={datos} descripcion={DESCRIPCION} centro={centro} />);
}

/** Colores de fondo de los elementos dibujados por el componente (los puntos de la leyenda), en orden. */
function coloresDeLosPuntos(): string[] {
  const colores: string[] = [];
  const recorrer = (nodo: any) => {
    if (!nodo || typeof nodo === 'string') return;
    if (Array.isArray(nodo)) return nodo.forEach(recorrer);
    const estilo = ([] as any[]).concat(nodo.props?.style ?? []).flat(Infinity);
    const fondo = estilo.find((e) => e && e.backgroundColor)?.backgroundColor;
    if (fondo) colores.push(fondo);
    recorrer(nodo.children);
  };
  recorrer(screen.toJSON());
  return colores;
}

const coloresDeLosSegmentos = () => props().data.map((d: any) => d.color);

beforeEach(() => {
  mockPieChart.mockClear();
  mockModo = 'light';
});

describe('GraficaDona', () => {
  it('CA-RF18-01 se anuncia con su descripción', async () => {
    await mostrar();
    expect(screen.getByLabelText(DESCRIPCION)).toBeOnTheScreen();
  });

  it('CA-RF18-02 la leyenda repite cada etiqueta con su valor en pesos, en orden', async () => {
    await mostrar();
    const textos = screen
      .getAllByText(/^(Comida|Transporte|Arriendo|Otros|\$[\d.]+)$/)
      .map((t) => t.props.children);
    expect(textos).toEqual([
      'Comida',
      '$650.000',
      'Transporte',
      '$320.000',
      'Arriendo',
      '$1.200.000',
      'Otros',
      '$180.000',
    ]);
  });

  it('CA-RF18-03 entrega un segmento por punto, con el valor sin cambiar y como dona', async () => {
    await mostrar();
    expect(props().data.map((d: any) => d.value)).toEqual([650000, 320000, 1200000, 180000]);
    expect(props().donut).toBe(true);
    expect(props().innerRadius).toBeGreaterThan(0);
  });

  it('CA-RF18-04 muestra en el centro el texto recibido tal como se pasó', async () => {
    await mostrar(CATEGORIAS, '$2.350.000');
    expect(screen.getByText('$2.350.000')).toBeOnTheScreen();
  });

  it('CA-RF18-04 sin centro el centro queda vacío y no aparece undefined', async () => {
    await mostrar();
    expect(screen.queryByText(/undefined|null/)).toBeNull();
  });

  it('CA-RF18-05 el color de cada segmento coincide con el de su fila de la leyenda', async () => {
    await mostrar(CATEGORIAS.slice(0, 3));
    expect(coloresDeLosPuntos()).toEqual(coloresDeLosSegmentos());
    expect(coloresDeLosSegmentos()).toHaveLength(3);
  });

  it('CA-RF18-06 la paleta se repite a partir del cuarto segmento', async () => {
    const siete = Array.from({ length: 7 }, (_, i) => ({ etiqueta: `Cat ${i + 1}`, valor: 100 }));
    await mostrar(siete);
    const c = coloresDeLosSegmentos();
    expect(c).toHaveLength(7);
    expect(c[3]).toBe(c[0]);
    expect(c[4]).toBe(c[1]);
    expect(c[5]).toBe(c[2]);
    expect(c[6]).toBe(c[0]);
    expect(coloresDeLosPuntos()).toEqual(c);
  });

  it('CA-RF18-07 los colores cambian con el modo claro y el oscuro', async () => {
    await mostrar(CATEGORIAS.slice(0, 3));
    expect(coloresDeLosSegmentos()).toEqual(['#FFD300', '#262B32', '#757B81']);
    expect(props().innerCircleColor).toBe('#FFFFFF');

    mockModo = 'dark';
    await mostrar(CATEGORIAS.slice(0, 3));
    expect(coloresDeLosSegmentos()).toEqual(['#FFD300', '#FFFFFF', '#757B81']);
    expect(props().innerCircleColor).toBe('#090C11');
  });

  it('CA-RF18-08 con una sola categoría muestra un segmento y una fila', async () => {
    await mostrar([{ etiqueta: 'Comida', valor: 650000 }]);
    expect(props().data).toHaveLength(1);
    expect(screen.getByText('Comida')).toBeOnTheScreen();
    expect(screen.getByText('$650.000')).toBeOnTheScreen();
    expect(coloresDeLosPuntos()).toHaveLength(1);
  });

  it('CA-RF18-09 una categoría en cero aparece con $0 y sin NaN', async () => {
    await mostrar([
      { etiqueta: 'Comida', valor: 650000 },
      { etiqueta: 'Otros', valor: 0 },
    ]);
    expect(screen.getByText('Otros')).toBeOnTheScreen();
    expect(screen.getByText('$0')).toBeOnTheScreen();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('CA-RF18-10 sin datos no se rompe, la leyenda queda sin filas y conserva la etiqueta', async () => {
    await mostrar([]);
    expect(screen.getByLabelText(DESCRIPCION)).toBeOnTheScreen();
    expect(props().data).toEqual([]);
    expect(coloresDeLosPuntos()).toHaveLength(0);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
