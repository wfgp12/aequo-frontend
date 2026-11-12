import { TarjetaEvolucionBalance } from '@/components/reportes/tarjeta-evolucion-balance';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerReporteEvolucion, type ReporteEvolucion } from '@/lib/api/reportes';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Tarjeta "Evolución del balance" (criterios/03-reportes-evolucion.md, CA-RF19-18 a 42). El backend se simula en el
// borde del adaptador y la librería de gráficas en el suyo: cada punto que recibe se dibuja con su etiqueta.
const mockLineChart = jest.fn((_props: any) => null);
let mockModo: 'light' | 'dark' = 'light';
let mockAnchoPantalla = 360;

jest.mock('react-native-gifted-charts', () => {
  const { Text, View } = require('react-native');
  return {
    LineChart: (props: any) => {
      mockLineChart(props);
      return (
        <>
          {props.data.map((d: any, i: number) => (
            <View key={i}>
              <Text>{d.label}</Text>
            </View>
          ))}
        </>
      );
    },
  };
});
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockModo }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockAnchoPantalla, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock('@/lib/api/reportes', () => ({ obtenerReporteEvolucion: jest.fn() }));

const obtener = jest.mocked(obtenerReporteEvolucion);

const TITULO = 'Evolución del balance';
const TEXTO_SERVIDOR = 'No pudimos cargar la evolución de tu balance. Inténtalo de nuevo en unos minutos.';
const TEXTO_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const TEXTO_VACIO = 'No hay movimientos en estos meses.';

/** Seis meses consecutivos que terminan en `hasta` (YYYY-MM), con los balances dados. */
function seisMeses(hasta: string, balances: number[]): ReporteEvolucion {
  const [anio, mes] = hasta.split('-').map(Number);
  const puntos = balances.map((balance, i) => {
    const indice = anio * 12 + (mes - 1) - (balances.length - 1 - i);
    return { periodo: `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`, balance };
  });
  return { desde: puntos[0].periodo, hasta, puntos };
}

const SEPTIEMBRE = () => seisMeses('2026-09', [1200000, 0, -300000, 450000, 800000, 1500000]);
const VACIO: ReporteEvolucion = { desde: '2026-04', hasta: '2026-09', puntos: [] };

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const props = () => mockLineChart.mock.calls[mockLineChart.mock.calls.length - 1][0];
const grafica = () => screen.queryByRole('image');
const cargando = () => screen.queryByLabelText('Cargando evolución del balance');
const valores = () => props().data.map((d: any) => d.value);
const etiquetas = () => props().data.map((d: any) => d.label);

async function mostrar(mes: string | undefined = '2026-09') {
  await render(<TarjetaEvolucionBalance mes={mes} />);
}

beforeEach(() => {
  obtener.mockReset().mockResolvedValue(SEPTIEMBRE());
  mockLineChart.mockClear();
  mockModo = 'light';
  mockAnchoPantalla = 360;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TarjetaEvolucionBalance: carga y errores', () => {
  it('CA-RF19-18 mientras carga muestra el título y el indicador, sin gráfica, vacío ni error', async () => {
    obtener.mockReturnValue(pendiente<ReporteEvolucion>().promesa);

    await mostrar();

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(cargando()).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF19-19 si el servidor falla avisa en lenguaje sencillo, con título y botón Reintentar, sin gráfica', async () => {
    obtener.mockRejectedValue(new ApiError(500, 'Internal server error'));

    await mostrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF19-19 un 400 tampoco muestra el texto técnico del backend', async () => {
    obtener.mockRejectedValue(new ApiError(400, 'desde no puede ser posterior a hasta'));

    await mostrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.queryByText(/posterior/)).toBeNull();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
  });

  it('CA-RF19-19 un 401 no muestra aviso propio (la app vuelve al login)', async () => {
    obtener.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await mostrar();

    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(screen.queryByText('Sesión inválida o vencida')).toBeNull();
    expect(grafica()).toBeNull();
  });

  it('CA-RF19-20 sin conexión lo dice y permite reintentar', async () => {
    obtener.mockRejectedValue(new NetworkError());

    await mostrar();

    expect(await screen.findByText(TEXTO_RED)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(grafica()).toBeNull();
  });

  it('CA-RF19-21 "Reintentar" quita el aviso, muestra la carga, vuelve a consultar el mismo rango y muestra la gráfica', async () => {
    obtener.mockRejectedValueOnce(new NetworkError());
    const segunda = pendiente<ReporteEvolucion>();
    obtener.mockReturnValueOnce(segunda.promesa);

    await mostrar('2026-09');
    await fireEvent.press(await screen.findByText('Reintentar'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(cargando()).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-04', hasta: '2026-09' });

    await act(async () => segunda.resolver(SEPTIEMBRE()));

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(cargando()).toBeNull();
  });

  it('CA-RF19-22 dos toques seguidos en "Reintentar" envían una sola solicitud', async () => {
    obtener.mockRejectedValueOnce(new ApiError(500, 'x'));
    obtener.mockReturnValueOnce(pendiente<ReporteEvolucion>().promesa);

    await mostrar();
    const boton = await screen.findByText('Reintentar');
    await fireEvent.press(boton);
    await fireEvent.press(boton);

    expect(obtener).toHaveBeenCalledTimes(2); // la inicial y un solo reintento
  });
});

describe('TarjetaEvolucionBalance: qué muestra', () => {
  it('CA-RF19-23 muestra el título y el subtítulo con el mes final', async () => {
    await mostrar('2026-09');

    await screen.findByRole('image');
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
  });

  it('CA-RF19-23 con febrero el subtítulo dice febrero, sin año', async () => {
    await mostrar('2026-02');

    await screen.findByRole('image');
    expect(screen.getByText('Últimos 6 meses hasta febrero')).toBeOnTheScreen();
  });

  it('CA-RF19-23 el subtítulo se ve también cargando, con error y sin movimientos', async () => {
    obtener.mockReturnValueOnce(pendiente<ReporteEvolucion>().promesa);
    const { unmount } = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
    await unmount();

    obtener.mockRejectedValueOnce(new ApiError(500, 'x'));
    const segundo = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await screen.findByRole('alert');
    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
    await segundo.unmount();

    obtener.mockResolvedValueOnce(VACIO);
    await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await screen.findByText(TEXTO_VACIO);
    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
  });

  it('CA-RF19-24 la gráfica recibe un punto por mes, en orden, con los valores y las etiquetas tal como llegaron', async () => {
    await mostrar();

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(props().data).toHaveLength(6);
    expect(valores()).toEqual([1200000, 0, -300000, 450000, 800000, 1500000]);
    expect(etiquetas()).toEqual(['abr', 'may', 'jun', 'jul', 'ago', 'sep']);
    expect(screen.getByText('abr')).toBeOnTheScreen();
    expect(screen.getByText('sep')).toBeOnTheScreen();
    expect(cargando()).toBeNull();
  });

  it('CA-RF19-25 las etiquetas de los doce meses son la abreviatura en minúscula', async () => {
    obtener.mockResolvedValue({
      desde: '2026-01',
      hasta: '2026-12',
      puntos: Array.from({ length: 12 }, (_, i) => ({ periodo: `2026-${String(i + 1).padStart(2, '0')}`, balance: i })),
    });

    await mostrar('2026-12');

    await screen.findByRole('image');
    expect(etiquetas()).toEqual(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);
  });

  it('CA-RF19-25 si la serie cruza el año, las etiquetas siguen el orden y no llevan año', async () => {
    obtener.mockResolvedValue(seisMeses('2026-02', [1, 2, 3, 4, 5, 6]));

    await mostrar('2026-02');

    await screen.findByRole('image');
    expect(etiquetas()).toEqual(['sep', 'oct', 'nov', 'dic', 'ene', 'feb']);
    expect(screen.queryByText(/2025|2026/)).toBeNull();
  });

  it('CA-RF19-26 los meses sin movimientos se dibujan en cero con su etiqueta', async () => {
    obtener.mockResolvedValue(seisMeses('2026-09', [500000, 0, 700000, 800000, 0, 900000]));

    await mostrar();

    await screen.findByRole('image');
    expect(props().data).toHaveLength(6);
    expect(valores()).toEqual([500000, 0, 700000, 800000, 0, 900000]);
    expect(etiquetas()[1]).toBe('may');
    expect(etiquetas()[4]).toBe('ago');
  });

  it('CA-RF19-27 el eje se lee en pesos, redondeado al peso solo al mostrar', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(props().formatYLabel(1500000)).toBe('$1.500.000');
    expect(props().formatYLabel(0)).toBe('$0');
    expect(props().formatYLabel(1234.6)).toBe('$1.235');
  });

  it('CA-RF19-28 un balance negativo llega a la gráfica sin cambiarlo y el eje lo escribe con el signo delante', async () => {
    obtener.mockResolvedValue(seisMeses('2026-09', [800000, 600000, -250000, 400000, 500000, 700000]));

    await mostrar();

    await screen.findByRole('image');
    expect(valores()[2]).toBe(-250000);
    expect(props().formatYLabel(-250000)).toBe('-$250.000');
    expect(props().formatYLabel(-1234.6)).toBe('-$1.235');
  });

  it('CA-RF19-30 en modo claro la línea y los puntos son grafito y los ejes conservan sus grises', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(props().color).toBe('#262B32');
    expect(props().dataPointsColor).toBe('#262B32');
    expect(props().xAxisLabelTextStyle.color).toBe('#757B81');
    expect(props().yAxisTextStyle.color).toBe('#757B81');
    expect(props().rulesColor).toBe('#E3E4E6');
  });

  it('CA-RF19-30 en modo oscuro la línea y los puntos son blancos y los ejes usan los grises del modo oscuro', async () => {
    mockModo = 'dark';

    await mostrar();

    await screen.findByRole('image');
    expect(props().color).toBe('#FFFFFF');
    expect(props().dataPointsColor).toBe('#FFFFFF');
    expect(props().xAxisLabelTextStyle.color).toBe('#A6A9AE');
    expect(props().yAxisTextStyle.color).toBe('#A6A9AE');
    expect(props().rulesColor).toBe('#262B32');
  });

  it('CA-RF19-31 la gráfica se anuncia como imagen con el rango de meses', async () => {
    await mostrar('2026-09');

    expect(await screen.findByRole('image', { name: 'Evolución del balance de abril a septiembre' })).toBeOnTheScreen();
  });

  it('CA-RF19-31 si el rango cruza el año, el anuncio lleva los años', async () => {
    obtener.mockResolvedValue(seisMeses('2026-02', [1, 2, 3, 4, 5, 6]));

    await mostrar('2026-02');

    expect(
      await screen.findByRole('image', { name: 'Evolución del balance de septiembre de 2025 a febrero de 2026' }),
    ).toBeOnTheScreen();
  });

  it('CA-RF19-32 solo habla del balance: ningún monto aparte del eje ni otros conceptos', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/Ingresos|Egresos|Pagos de tarjeta|Abonos|Dinero recibido/i)).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF19-33 con los seis meses en cero muestra la gráfica con $0, sin vacío, sin error y sin NaN', async () => {
    obtener.mockResolvedValue(seisMeses('2026-09', [0, 0, 0, 0, 0, 0]));

    await mostrar();

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(props().data).toHaveLength(6);
    expect(valores()).toEqual([0, 0, 0, 0, 0, 0]);
    expect(etiquetas()).toEqual(['abr', 'may', 'jun', 'jul', 'ago', 'sep']);
    expect(props().formatYLabel(0)).toBe('$0');
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF19-34 con un solo punto lo muestra con su etiqueta y no inventa los demás', async () => {
    obtener.mockResolvedValue({ desde: '2026-09', hasta: '2026-09', puntos: [{ periodo: '2026-09', balance: 450000 }] });

    await mostrar();

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(props().data).toHaveLength(1);
    expect(etiquetas()).toEqual(['sep']);
    expect(valores()).toEqual([450000]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF19-35 con valores muy distintos los entrega sin cambiarlos y el eje escribe las marcas completas', async () => {
    obtener.mockResolvedValue(seisMeses('2026-09', [-12000000, 500, 9900000, 0, 100, -50]));

    await mostrar();

    await screen.findByRole('image');
    expect(valores()).toEqual([-12000000, 500, 9900000, 0, 100, -50]);
    expect(props().formatYLabel(-12000000)).toBe('-$12.000.000');
    expect(props().formatYLabel(9900000)).toBe('$9.900.000');
    expect(props().width + props().yAxisLabelWidth).toBeLessThanOrEqual(360 - 48 - 34);
  });

  it('CA-RF19-36 en 360 px la gráfica mide 206 y no se sale de la tarjeta', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(props().width).toBe(206);
    expect(props().yAxisLabelWidth).toBe(72);
  });

  it('CA-RF19-36 en 1280 px no pasa del tope de las gráficas', async () => {
    mockAnchoPantalla = 1280;

    await mostrar();

    await screen.findByRole('image');
    expect(props().width + props().yAxisLabelWidth).toBe(640);
  });

  it('CA-RF19-37 con puntos vacíos muestra el aviso sencillo y no la gráfica', async () => {
    obtener.mockResolvedValue(VACIO);

    await mostrar();

    expect(await screen.findByText(TEXTO_VACIO)).toBeOnTheScreen();
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(mockLineChart).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(cargando()).toBeNull();
  });
});

describe('TarjetaEvolucionBalance: el rango de meses', () => {
  it('CA-RF19-38 con mes pide los seis meses que terminan en él y hace una sola consulta', async () => {
    await mostrar('2026-09');

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-04', hasta: '2026-09' });
  });

  it('CA-RF19-38 con junio pide de enero a junio', async () => {
    await mostrar('2026-06');

    await screen.findByRole('image');
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-01', hasta: '2026-06' });
  });

  it('CA-RF19-38 con diciembre pide de julio a diciembre', async () => {
    await mostrar('2026-12');

    await screen.findByRole('image');
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-07', hasta: '2026-12' });
  });

  it.each([
    ['2026-02', '2025-09'],
    ['2026-01', '2025-08'],
    ['2026-05', '2025-12'],
  ])('CA-RF19-39 con mes %s el rango empieza en %s, del año anterior', async (mes, desde) => {
    await mostrar(mes);

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ desde, hasta: mes });
  });

  it('CA-RF19-40 sin mes la ventana termina en el mes actual del dispositivo', async () => {
    // Solo se congela la fecha, con una fecha local (no depende de la zona de la máquina)
    jest.useFakeTimers({
      now: new Date(2026, 10, 15, 12),
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });

    await render(<TarjetaEvolucionBalance />);

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-06', hasta: '2026-11' });
    expect(screen.getByText('Últimos 6 meses hasta noviembre')).toBeOnTheScreen();
  });

  it('CA-RF19-41 al cambiar el mes pide el nuevo, muestra la carga (no los datos viejos) y luego los nuevos', async () => {
    obtener.mockResolvedValueOnce(seisMeses('2026-09', [1, 2, 3, 4, 5, 6]));
    const octubre = pendiente<ReporteEvolucion>();
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await screen.findByRole('image');
    expect(valores()).toEqual([1, 2, 3, 4, 5, 6]);

    await rerender(<TarjetaEvolucionBalance mes="2026-10" />);

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-05', hasta: '2026-10' });
    expect(screen.getByText('Últimos 6 meses hasta octubre')).toBeOnTheScreen();
    expect(cargando()).toBeOnTheScreen();
    expect(grafica()).toBeNull();

    await act(async () => octubre.resolver(seisMeses('2026-10', [10, 20, 30, 40, 50, 60])));

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(valores()).toEqual([10, 20, 30, 40, 50, 60]);
    expect(etiquetas()).toEqual(['may', 'jun', 'jul', 'ago', 'sep', 'oct']);
    expect(cargando()).toBeNull();
  });

  it('CA-RF19-42 si la respuesta de septiembre llega después que la de octubre, se ignora', async () => {
    const septiembre = pendiente<ReporteEvolucion>();
    const octubre = pendiente<ReporteEvolucion>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await rerender(<TarjetaEvolucionBalance mes="2026-10" />);

    await act(async () => octubre.resolver(seisMeses('2026-10', [10, 20, 30, 40, 50, 60])));
    await act(async () => septiembre.resolver(seisMeses('2026-09', [1, 2, 3, 4, 5, 6])));

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(valores()).toEqual([10, 20, 30, 40, 50, 60]);
    expect(etiquetas()).toEqual(['may', 'jun', 'jul', 'ago', 'sep', 'oct']);
  });

  it('CA-RF19-42 si la respuesta de septiembre llega antes de que octubre responda, no se muestra', async () => {
    const septiembre = pendiente<ReporteEvolucion>();
    const octubre = pendiente<ReporteEvolucion>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await rerender(<TarjetaEvolucionBalance mes="2026-10" />);
    await act(async () => septiembre.resolver(seisMeses('2026-09', [1, 2, 3, 4, 5, 6])));

    expect(grafica()).toBeNull();
    expect(mockLineChart).not.toHaveBeenCalled();
    expect(cargando()).toBeOnTheScreen();
  });

  it('CA-RF19-42 un error de la consulta vieja no reemplaza lo que se ve', async () => {
    const septiembre = pendiente<ReporteEvolucion>();
    const octubre = pendiente<ReporteEvolucion>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEvolucionBalance mes="2026-09" />);
    await rerender(<TarjetaEvolucionBalance mes="2026-10" />);
    await act(async () => octubre.resolver(seisMeses('2026-10', [10, 20, 30, 40, 50, 60])));
    await act(async () => septiembre.rechazar(new ApiError(500, 'x')));

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});
