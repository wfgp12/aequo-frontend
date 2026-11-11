import { TarjetaIngresosEgresos } from '@/components/reportes/tarjeta-ingresos-egresos';
import { ApiError, NetworkError } from '@/lib/api/client';
import { obtenerReportePeriodo, type ReportePeriodo } from '@/lib/api/reportes';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Tarjeta "Ingresos vs egresos" (criterios/03-reportes-ingresos-egresos.md, CA-RF17-22 a 38). El backend se simula en
// el borde del adaptador y la librería de gráficas en el suyo: cada punto que recibe se dibuja con su etiqueta
// y su rótulo superior (`topLabelComponent`), para ver lo que vería el usuario.
const mockBarChart = jest.fn((_props: any) => null);
let mockModo: 'light' | 'dark' = 'light';
let mockAnchoPantalla = 360;

jest.mock('react-native-gifted-charts', () => {
  const { Text, View } = require('react-native');
  return {
    BarChart: (props: any) => {
      mockBarChart(props);
      return (
        <>
          {props.data.map((d: any, i: number) => (
            <View key={i}>
              {d.topLabelComponent ? d.topLabelComponent() : null}
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
jest.mock('@/lib/api/reportes', () => ({ obtenerReportePeriodo: jest.fn() }));

const obtener = jest.mocked(obtenerReportePeriodo);

const TITULO = 'Ingresos vs egresos';
const TEXTO_SERVIDOR = 'No pudimos cargar tus ingresos y egresos. Inténtalo de nuevo en unos minutos.';
const TEXTO_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const TEXTO_VACIO = 'No hay movimientos en este periodo.';

const reporte = (ingresos: number, egresos: number, resto: Partial<ReportePeriodo> = {}): ReportePeriodo => ({
  desde: '2026-10-01',
  hasta: '2026-10-31',
  ingresos,
  egresos,
  pagosTarjeta: 0,
  abonosDeuda: 0,
  dineroRecibido: 0,
  balance: ingresos - egresos,
  ...resto,
});

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const props = () => mockBarChart.mock.calls[mockBarChart.mock.calls.length - 1][0];
const grafica = () => screen.queryByRole('image');
const cargando = () => screen.queryByLabelText('Cargando ingresos y egresos');

async function mostrar(periodo: { mes?: string; desde?: string; hasta?: string } = {}) {
  await render(<TarjetaIngresosEgresos {...periodo} />);
}

beforeEach(() => {
  obtener.mockReset().mockResolvedValue(reporte(3400000, 2150000));
  mockBarChart.mockClear();
  mockModo = 'light';
  mockAnchoPantalla = 360;
});

describe('TarjetaIngresosEgresos: carga y errores', () => {
  it('CA-RF17-22 mientras carga muestra el título y el indicador, sin gráfica, vacío ni error', async () => {
    obtener.mockReturnValue(pendiente<ReportePeriodo>().promesa);

    await mostrar();

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(cargando()).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF17-23 si el servidor falla avisa en lenguaje sencillo, con título y botón Reintentar, sin gráfica', async () => {
    obtener.mockRejectedValue(new ApiError(500, 'Internal server error'));

    await mostrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF17-23 un 400 tampoco muestra el texto técnico del backend', async () => {
    obtener.mockRejectedValue(new ApiError(400, 'mes debe tener el formato YYYY-MM con un mes del 01 al 12'));

    await mostrar({ mes: '2026-13' });

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.queryByText(/YYYY-MM/)).toBeNull();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
  });

  it('CA-RF17-23 un 401 no muestra aviso propio (la app vuelve al login)', async () => {
    obtener.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await mostrar();

    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(screen.queryByText('Sesión inválida o vencida')).toBeNull();
    expect(grafica()).toBeNull();
  });

  it('CA-RF17-24 sin conexión lo dice y permite reintentar', async () => {
    obtener.mockRejectedValue(new NetworkError());

    await mostrar();

    expect(await screen.findByText(TEXTO_RED)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(grafica()).toBeNull();
  });

  it('CA-RF17-25 "Reintentar" quita el aviso, muestra la carga, vuelve a consultar el mismo periodo y muestra la gráfica', async () => {
    obtener.mockRejectedValueOnce(new NetworkError());
    const segunda = pendiente<ReportePeriodo>();
    obtener.mockReturnValueOnce(segunda.promesa);

    await mostrar({ mes: '2026-09' });
    await fireEvent.press(await screen.findByText('Reintentar'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(cargando()).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ mes: '2026-09' });

    await act(async () => segunda.resolver(reporte(3400000, 2150000)));

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(cargando()).toBeNull();
  });

  it('CA-RF17-26 dos toques seguidos en "Reintentar" envían una sola solicitud', async () => {
    obtener.mockRejectedValueOnce(new ApiError(500, 'x'));
    obtener.mockReturnValueOnce(pendiente<ReportePeriodo>().promesa);

    await mostrar();
    const boton = await screen.findByText('Reintentar');
    await fireEvent.press(boton);
    await fireEvent.press(boton);

    expect(obtener).toHaveBeenCalledTimes(2); // la inicial y un solo reintento
  });
});

describe('TarjetaIngresosEgresos: qué muestra', () => {
  it('CA-RF17-27 muestra el título y dos barras, Ingresos y Egresos, con los valores tal como llegaron', async () => {
    await mostrar();

    expect(await screen.findByRole('image')).toBeOnTheScreen();
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(props().data).toHaveLength(2);
    expect(props().data[0]).toMatchObject({ label: 'Ingresos', value: 3400000 });
    expect(props().data[1]).toMatchObject({ label: 'Egresos', value: 2150000 });
    expect(cargando()).toBeNull();
  });

  it('CA-RF17-27 no reordena aunque los egresos superen a los ingresos', async () => {
    obtener.mockResolvedValue(reporte(100000, 900000));

    await mostrar();

    await screen.findByRole('image');
    expect(props().data.map((d: any) => [d.label, d.value])).toEqual([
      ['Ingresos', 100000],
      ['Egresos', 900000],
    ]);
  });

  it('CA-RF17-28 muestra el valor en pesos sobre cada barra y la etiqueta debajo', async () => {
    await mostrar();

    expect(await screen.findByText('$3.400.000')).toBeOnTheScreen();
    expect(screen.getByText('$2.150.000')).toBeOnTheScreen();
    expect(screen.getByText('Ingresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos')).toBeOnTheScreen();
  });

  it('CA-RF17-29 en modo claro Ingresos es grafito y Egresos gris, distintos entre sí', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(props().data[0].frontColor).toBe('#262B32');
    expect(props().data[1].frontColor).toBe('#757B81');
  });

  it('CA-RF17-29 en modo oscuro Ingresos es blanco y Egresos sigue gris', async () => {
    mockModo = 'dark';

    await mostrar();

    await screen.findByRole('image');
    expect(props().data[0].frontColor).toBe('#FFFFFF');
    expect(props().data[1].frontColor).toBe('#757B81');
  });

  it('CA-RF17-30 redondea al peso al mostrar, pero la gráfica recibe los valores como llegaron', async () => {
    obtener.mockResolvedValue(reporte(3400000.4, 2150000.6));

    await mostrar();

    expect(await screen.findByText('$3.400.000')).toBeOnTheScreen();
    expect(screen.getByText('$2.150.001')).toBeOnTheScreen();
    expect(props().data[0].value).toBe(3400000.4);
    expect(props().data[1].value).toBe(2150000.6);
  });

  it('CA-RF17-31 no muestra pagos de tarjeta, abonos, dinero recibido ni balance', async () => {
    obtener.mockResolvedValue(
      reporte(3400000, 2150000, {
        pagosTarjeta: 120000,
        abonosDeuda: 230000,
        dineroRecibido: 1010000,
        balance: 1250000,
      }),
    );

    await mostrar();

    await screen.findByRole('image');
    expect(screen.queryByText(/Balance|Pagos de tarjeta|Abonos|Dinero recibido/i)).toBeNull();
    expect(screen.queryByText(/120\.000|230\.000|1\.010\.000|1\.250\.000/)).toBeNull();
    expect(props().data).toHaveLength(2);
  });

  it('CA-RF17-32 la gráfica se anuncia como imagen con los dos valores redondeados al peso', async () => {
    await mostrar();

    expect(
      await screen.findByRole('image', { name: 'Ingresos de $3.400.000 y egresos de $2.150.000' }),
    ).toBeOnTheScreen();
  });

  it('CA-RF17-32 el anuncio usa los valores ya redondeados', async () => {
    obtener.mockResolvedValue(reporte(3400000.4, 2150000.6));

    await mostrar();

    expect(
      await screen.findByRole('image', { name: 'Ingresos de $3.400.000 y egresos de $2.150.001' }),
    ).toBeOnTheScreen();
  });

  it('CA-RF17-33 con ingresos en cero muestra las dos barras, $0 sobre Ingresos y sin vacío ni NaN', async () => {
    obtener.mockResolvedValue(reporte(0, 500000));

    await mostrar();

    expect(await screen.findByText('$0')).toBeOnTheScreen();
    expect(screen.getByText('$500.000')).toBeOnTheScreen();
    expect(screen.getByText('Ingresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF17-33 con egresos en cero pasa lo mismo al revés', async () => {
    obtener.mockResolvedValue(reporte(800000, 0));

    await mostrar();

    expect(await screen.findByText('$800.000')).toBeOnTheScreen();
    expect(screen.getByText('$0')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF17-34 con valores muy distintos muestra ambos sin cambiarlos y cabe en el ancho de la pantalla', async () => {
    obtener.mockResolvedValue(reporte(10000000, 1000));

    await mostrar();

    expect(await screen.findByText('$10.000.000')).toBeOnTheScreen();
    expect(screen.getByText('$1.000')).toBeOnTheScreen();
    expect(props().data.map((d: any) => d.value)).toEqual([10000000, 1000]);
    expect(props().width + props().yAxisLabelWidth).toBeLessThanOrEqual(360 - 48);
  });

  it('CA-RF17-35 sin ingresos ni egresos muestra el aviso sencillo y no la gráfica', async () => {
    obtener.mockResolvedValue(reporte(0, 0));

    await mostrar();

    expect(await screen.findByText(TEXTO_VACIO)).toBeOnTheScreen();
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(mockBarChart).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF17-35 cuenta como vacío aunque haya pagos de tarjeta, abonos o dinero recibido', async () => {
    obtener.mockResolvedValue(
      reporte(0, 0, { pagosTarjeta: 120000, abonosDeuda: 230000, dineroRecibido: 1010000, balance: -350000 }),
    );

    await mostrar();

    expect(await screen.findByText(TEXTO_VACIO)).toBeOnTheScreen();
    expect(grafica()).toBeNull();
    expect(screen.queryByText(/120\.000|230\.000|1\.010\.000|350\.000/)).toBeNull();
  });
});

describe('TarjetaIngresosEgresos: el periodo', () => {
  it('CA-RF17-36 con mes pide ese mes', async () => {
    await mostrar({ mes: '2026-09' });

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ mes: '2026-09' });
  });

  it('CA-RF17-36 con desde y hasta pide ese rango', async () => {
    await mostrar({ desde: '2026-10-10', hasta: '2026-10-20' });

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-10-10', hasta: '2026-10-20' });
  });

  it('CA-RF17-36 sin periodo pide el reporte sin parámetros y hace una sola consulta', async () => {
    await mostrar();

    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0] ?? {}).toEqual({});
  });

  it('CA-RF17-37 al cambiar de mes pide el nuevo, muestra la carga (no los datos viejos) y luego los datos nuevos', async () => {
    obtener.mockResolvedValueOnce(reporte(1000000, 400000));
    const octubre = pendiente<ReportePeriodo>();
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaIngresosEgresos mes="2026-09" />);
    expect(await screen.findByText('$1.000.000')).toBeOnTheScreen();

    await rerender(<TarjetaIngresosEgresos mes="2026-10" />);

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ mes: '2026-10' });
    expect(cargando()).toBeOnTheScreen();
    expect(screen.queryByText('$1.000.000')).toBeNull();
    expect(grafica()).toBeNull();

    await act(async () => octubre.resolver(reporte(5000000, 2000000)));

    expect(await screen.findByText('$5.000.000')).toBeOnTheScreen();
    expect(screen.queryByText('$1.000.000')).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF17-37 al pasar de un mes a un rango vuelve a pedir', async () => {
    const { rerender } = await render(<TarjetaIngresosEgresos mes="2026-09" />);
    await screen.findByRole('image');

    await rerender(<TarjetaIngresosEgresos desde="2026-10-10" hasta="2026-10-20" />);

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-10-10', hasta: '2026-10-20' });
  });

  it('CA-RF17-37 al cambiar solo desde o solo hasta vuelve a pedir', async () => {
    const { rerender } = await render(<TarjetaIngresosEgresos desde="2026-10-10" hasta="2026-10-20" />);
    await screen.findByRole('image');

    await rerender(<TarjetaIngresosEgresos desde="2026-10-11" hasta="2026-10-20" />);
    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-10-11', hasta: '2026-10-20' });

    await rerender(<TarjetaIngresosEgresos desde="2026-10-11" hasta="2026-10-25" />);
    await screen.findByRole('image');
    expect(obtener).toHaveBeenCalledTimes(3);
    expect(obtener.mock.calls[2][0]).toEqual({ desde: '2026-10-11', hasta: '2026-10-25' });
  });

  it('CA-RF17-38 si la respuesta de septiembre llega después que la de octubre, se ignora', async () => {
    const septiembre = pendiente<ReportePeriodo>();
    const octubre = pendiente<ReportePeriodo>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaIngresosEgresos mes="2026-09" />);
    await rerender(<TarjetaIngresosEgresos mes="2026-10" />);

    await act(async () => octubre.resolver(reporte(5000000, 2000000)));
    await act(async () => septiembre.resolver(reporte(1000000, 400000)));

    expect(await screen.findByText('$5.000.000')).toBeOnTheScreen();
    expect(screen.queryByText('$1.000.000')).toBeNull();
    expect(props().data[0].value).toBe(5000000);
  });

  it('CA-RF17-38 si la respuesta de septiembre llega antes de que octubre responda, no se muestra', async () => {
    const septiembre = pendiente<ReportePeriodo>();
    const octubre = pendiente<ReportePeriodo>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaIngresosEgresos mes="2026-09" />);
    await rerender(<TarjetaIngresosEgresos mes="2026-10" />);
    await act(async () => septiembre.resolver(reporte(1000000, 400000)));

    expect(screen.queryByText('$1.000.000')).toBeNull();
    expect(cargando()).toBeOnTheScreen();
  });

  it('CA-RF17-38 un error de la consulta vieja no reemplaza lo que se ve', async () => {
    const septiembre = pendiente<ReportePeriodo>();
    const octubre = pendiente<ReportePeriodo>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaIngresosEgresos mes="2026-09" />);
    await rerender(<TarjetaIngresosEgresos mes="2026-10" />);
    await act(async () => octubre.resolver(reporte(5000000, 2000000)));
    await act(async () => septiembre.rechazar(new ApiError(500, 'x')));

    expect(await screen.findByText('$5.000.000')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});
