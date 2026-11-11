import { TarjetaEgresosPorCategoria } from '@/components/reportes/tarjeta-egresos-por-categoria';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  obtenerReporteCategorias,
  type CategoriaGasto,
  type ReporteCategorias,
} from '@/lib/api/reportes';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// Tarjeta "Egresos por categoría" (criterios/03-reportes-por-categoria.md, CA-RF18-19 a 40). El backend se simula
// en el borde del adaptador; el ancho y el color de las barras se leen por los testID acordados.
let mockModo: 'light' | 'dark' = 'light';

jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockModo }),
}));
jest.mock('@/lib/api/reportes', () => ({ obtenerReporteCategorias: jest.fn() }));

const obtener = jest.mocked(obtenerReporteCategorias);

const TITULO = 'Egresos por categoría';
const SUBTITULO = 'Toca una categoría para ver sus movimientos';
const TEXTO_SERVIDOR = 'No pudimos cargar tus egresos por categoría. Inténtalo de nuevo en unos minutos.';
const TEXTO_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const TEXTO_VACIO = 'No hay egresos en este periodo.';

const cat = (nombre: string, total: number, porcentaje: number, categoriaId: string | null = `id-${nombre}`): CategoriaGasto => ({
  categoriaId,
  nombre,
  total,
  porcentaje,
});

const reporte = (categorias: CategoriaGasto[], total?: number): ReporteCategorias => ({
  desde: '2026-10-01',
  hasta: '2026-10-31',
  total: total ?? categorias.reduce((suma, c) => suma + c.total, 0),
  categorias,
});

const FIGMA = reporte(
  [
    cat('Alimentación', 780000, 36),
    cat('Hogar', 520000, 24),
    cat('Transporte', 380000, 17.5),
    cat('Salud', 240000, 11),
    cat('Entretenimiento', 150000, 7),
    cat('Otros egresos', 100000, 4.5),
  ],
  2170000,
);

function pendiente<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const cargando = () => screen.queryByLabelText('Cargando egresos por categoría');
// Cada fila con categoría se anuncia como "Nombre, $monto"
const filas = () => screen.queryAllByLabelText(/, \$\d/);
const etiquetasDeFilas = () => filas().map((f) => f.props.accessibilityLabel);
const estilo = (elemento: { props: { style?: unknown } }) => StyleSheet.flatten(elemento.props.style as never) as Record<string, unknown>;
const barras = () => screen.queryAllByTestId('barra-categoria');

async function mostrar(
  props: { mes?: string; desde?: string; hasta?: string; onElegirCategoria?: (id: string, nombre: string) => void } = {},
) {
  await render(<TarjetaEgresosPorCategoria {...props} />);
}

beforeEach(() => {
  obtener.mockReset().mockResolvedValue(FIGMA);
  mockModo = 'light';
});

describe('TarjetaEgresosPorCategoria: carga y errores', () => {
  it('CA-RF18-19 mientras carga muestra el título y el indicador, sin filas, vacío, error ni subtítulo', async () => {
    obtener.mockReturnValue(pendiente<ReporteCategorias>().promesa);

    await mostrar({ onElegirCategoria: jest.fn() });

    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(cargando()).toBeOnTheScreen();
    expect(filas()).toHaveLength(0);
    expect(barras()).toHaveLength(0);
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(SUBTITULO)).toBeNull();
  });

  it('CA-RF18-20 si el servidor falla avisa en lenguaje sencillo, con título y botón Reintentar, sin filas ni subtítulo', async () => {
    obtener.mockRejectedValue(new ApiError(500, 'Internal server error'));

    await mostrar({ onElegirCategoria: jest.fn() });

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
    expect(filas()).toHaveLength(0);
    expect(screen.queryByText(SUBTITULO)).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF18-20 un 400 tampoco muestra el texto técnico del backend', async () => {
    obtener.mockRejectedValue(new ApiError(400, 'mes debe tener el formato YYYY-MM con un mes del 01 al 12'));

    await mostrar({ mes: '2026-13' });

    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR);
    expect(screen.queryByText(/YYYY-MM/)).toBeNull();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
  });

  it('CA-RF18-20 un 401 no muestra aviso propio (la app vuelve al login)', async () => {
    obtener.mockRejectedValue(new ApiError(401, 'Sesión inválida o vencida'));

    await mostrar();

    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(screen.queryByText('Sesión inválida o vencida')).toBeNull();
    expect(filas()).toHaveLength(0);
  });

  it('CA-RF18-21 sin conexión lo dice y permite reintentar', async () => {
    obtener.mockRejectedValue(new NetworkError());

    await mostrar();

    expect(await screen.findByText(TEXTO_RED)).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTO_SERVIDOR)).toBeNull();
    expect(filas()).toHaveLength(0);
  });

  it('CA-RF18-22 "Reintentar" quita el aviso, muestra la carga, vuelve a consultar el mismo periodo y muestra las categorías', async () => {
    obtener.mockRejectedValueOnce(new NetworkError());
    const segunda = pendiente<ReporteCategorias>();
    obtener.mockReturnValueOnce(segunda.promesa);

    await mostrar({ mes: '2026-09' });
    await fireEvent.press(await screen.findByText('Reintentar'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(cargando()).toBeOnTheScreen();
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ mes: '2026-09' });

    await act(async () => segunda.resolver(FIGMA));

    expect(await screen.findByText('Alimentación')).toBeOnTheScreen();
    expect(cargando()).toBeNull();
  });

  it('CA-RF18-23 dos toques seguidos en "Reintentar" envían una sola solicitud', async () => {
    obtener.mockRejectedValueOnce(new ApiError(500, 'x'));
    obtener.mockReturnValueOnce(pendiente<ReporteCategorias>().promesa);

    await mostrar();
    const boton = await screen.findByText('Reintentar');
    await fireEvent.press(boton);
    await fireEvent.press(boton);

    expect(obtener).toHaveBeenCalledTimes(2); // la inicial y un solo reintento
  });
});

describe('TarjetaEgresosPorCategoria: qué muestra', () => {
  it('CA-RF18-24 una fila por categoría, con nombre y monto, en el orden del backend, sin total ni porcentajes', async () => {
    await mostrar();

    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    await screen.findByText('Alimentación');
    expect(etiquetasDeFilas()).toEqual([
      'Alimentación, $780.000',
      'Hogar, $520.000',
      'Transporte, $380.000',
      'Salud, $240.000',
      'Entretenimiento, $150.000',
      'Otros egresos, $100.000',
    ]);
    expect(screen.getByText('$780.000')).toBeOnTheScreen();
    expect(screen.getByText('$100.000')).toBeOnTheScreen();
    expect(screen.queryByText(/2\.170\.000/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF18-24 no reordena: si el backend manda otro orden, se ve ese orden', async () => {
    obtener.mockResolvedValue(reporte([cat('Salud', 100, 10), cat('Alimentación', 900, 90)]));

    await mostrar();

    await screen.findByText('Salud');
    expect(etiquetasDeFilas()).toEqual(['Salud, $100', 'Alimentación, $900']);
  });

  it('CA-RF18-25 redondea al peso al mostrar los montos con decimales', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 780000.4, 60), cat('Hogar', 519999.6, 40)]));

    await mostrar();

    expect(await screen.findByText('$780.000')).toBeOnTheScreen();
    expect(screen.getByText('$520.000')).toBeOnTheScreen();
    expect(etiquetasDeFilas()).toEqual(['Alimentación, $780.000', 'Hogar, $520.000']);
  });

  it('CA-RF18-26 cada barra mide exactamente el porcentaje del backend, tal como llega', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 600, 60), cat('Hogar', 300, 30), cat('Salud', 100, 10)]));

    await mostrar();

    await screen.findByText('Alimentación');
    expect(barras().map((b) => estilo(b).width)).toEqual(['60%', '30%', '10%']);
    expect(screen.getAllByTestId('riel-categoria')).toHaveLength(3);
  });

  it('CA-RF18-26 un porcentaje con decimales se usa sin redondear', async () => {
    obtener.mockResolvedValue(
      reporte([cat('Alimentación', 100, 33.3333333), cat('Hogar', 100, 33.3333333), cat('Salud', 100, 33.3333334)]),
    );

    await mostrar();

    await screen.findByText('Alimentación');
    expect(barras().map((b) => estilo(b).width)).toEqual(['33.3333333%', '33.3333333%', '33.3333334%']);
  });

  it('CA-RF18-26 la barra va dentro de un riel (cada fila trae el suyo)', async () => {
    await mostrar();

    await screen.findByText('Alimentación');
    const rieles = screen.getAllByTestId('riel-categoria');
    expect(rieles).toHaveLength(6);
    expect(barras()).toHaveLength(6);
    rieles.forEach((riel) => expect(within(riel).getAllByTestId('barra-categoria')).toHaveLength(1));
  });

  it('CA-RF18-27 en modo claro la barra es grafito sobre un riel gris claro', async () => {
    await mostrar();

    await screen.findByText('Alimentación');
    barras().forEach((b) => expect(estilo(b).backgroundColor).toBe('#262B32'));
    screen.getAllByTestId('riel-categoria').forEach((r) => expect(estilo(r).backgroundColor).toBe('#E3E4E6'));
  });

  it('CA-RF18-27 en modo oscuro la barra es blanca sobre un riel #262B32', async () => {
    mockModo = 'dark';

    await mostrar();

    await screen.findByText('Alimentación');
    barras().forEach((b) => expect(estilo(b).backgroundColor).toBe('#FFFFFF'));
    screen.getAllByTestId('riel-categoria').forEach((r) => expect(estilo(r).backgroundColor).toBe('#262B32'));
  });

  it('CA-RF18-28 cada fila se anuncia con su nombre y su monto ya redondeado, como un solo elemento accesible', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 780000.4, 100)]));

    await mostrar();

    const fila = await screen.findByLabelText('Alimentación, $780.000');
    expect(fila.props.accessible).toBe(true);
  });

  it('CA-RF18-29 con onElegirCategoria cada fila es un botón con ">" y se ve el subtítulo', async () => {
    await mostrar({ onElegirCategoria: jest.fn() });

    expect(await screen.findByText(SUBTITULO)).toBeOnTheScreen();
    const botones = screen.getAllByRole('button');
    expect(botones).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Alimentación, $780.000' })).toBeOnTheScreen();
    botones.forEach((b) => expect(within(b).getByText('>')).toBeOnTheScreen());
  });

  it('CA-RF18-29 tocar una fila avisa su categoría una sola vez', async () => {
    const alElegir = jest.fn();
    obtener.mockResolvedValue(
      reporte([cat('Alimentación', 780000, 60, '665f1c2e9b1d4a0012ab3a01'), cat('Hogar', 520000, 40, 'id-hogar')]),
    );

    await mostrar({ onElegirCategoria: alElegir });
    await fireEvent.press(await screen.findByRole('button', { name: 'Alimentación, $780.000' }));

    expect(alElegir).toHaveBeenCalledTimes(1);
    expect(alElegir).toHaveBeenCalledWith('665f1c2e9b1d4a0012ab3a01', 'Alimentación');
  });

  it('CA-RF18-30 sin onElegirCategoria las filas no son botones, no llevan ">" ni subtítulo, pero se ven igual', async () => {
    await mostrar();

    await screen.findByText('Alimentación');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('>')).toBeNull();
    expect(screen.queryByText(SUBTITULO)).toBeNull();
    expect(screen.getByText('$780.000')).toBeOnTheScreen();
    expect(filas()).toHaveLength(6);
    expect(barras()).toHaveLength(6);
    expect(screen.getByLabelText('Alimentación, $780.000').props.accessible).toBe(true);
  });

  it('CA-RF18-31 "Sin categoría" se ve en su posición, sin botón ni ">", y tocarla no avisa; las demás siguen siendo botones', async () => {
    const alElegir = jest.fn();
    obtener.mockResolvedValue(
      reporte([cat('Alimentación', 600000, 60), cat('Sin categoría', 90000, 9, null), cat('Hogar', 310000, 31)]),
    );

    await mostrar({ onElegirCategoria: alElegir });

    expect(await screen.findByText('Sin categoría')).toBeOnTheScreen();
    expect(screen.getByText('$90.000')).toBeOnTheScreen();
    expect(etiquetasDeFilas()).toEqual(['Alimentación, $600.000', 'Sin categoría, $90.000', 'Hogar, $310.000']);
    expect(barras().map((b) => estilo(b).width)).toEqual(['60%', '9%', '31%']);
    expect(screen.queryByRole('button', { name: /Sin categoría/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(within(screen.getByLabelText('Sin categoría, $90.000')).queryByText('>')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Sin categoría, $90.000'));
    expect(alElegir).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Hogar, $310.000' }));
    expect(alElegir).toHaveBeenCalledWith('id-Hogar', 'Hogar');
  });

  it('CA-RF18-32 un nombre largo ocupa una línea, el monto se ve completo y la etiqueta conserva el nombre completo', async () => {
    const largo = 'Gastos varios de la casa, el colegio y las mascotas del mes';
    obtener.mockResolvedValue(reporte([cat(largo, 1234567, 100)]));

    await mostrar();

    expect((await screen.findByText(largo)).props.numberOfLines).toBe(1);
    expect(screen.getByText('$1.234.567')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${largo}, $1.234.567`)).toBeOnTheScreen();
  });

  it('CA-RF18-33 con una sola categoría ve una fila y su barra al 100 %, sin NaN', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 780000, 100)]));

    await mostrar();

    expect(await screen.findByText('$780.000')).toBeOnTheScreen();
    expect(filas()).toHaveLength(1);
    expect(barras().map((b) => estilo(b).width)).toEqual(['100%']);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF18-34 con valores muy distintos muestra los dos montos completos y los porcentajes tal como llegan', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 9900000, 99.99), cat('Otros egresos', 1000, 0.01)]));

    await mostrar();

    expect(await screen.findByText('$9.900.000')).toBeOnTheScreen();
    expect(screen.getByText('$1.000')).toBeOnTheScreen();
    expect(barras().map((b) => estilo(b).width)).toEqual(['99.99%', '0.01%']);
  });

  it('CA-RF18-35 muestra todas las categorías que manda el backend, en el orden recibido, sin agrupar', async () => {
    const quince = Array.from({ length: 15 }, (_, i) => cat(`Categoría ${String(i + 1).padStart(2, '0')}`, 1000 * (16 - i), 100 / 15));
    obtener.mockResolvedValue(reporte(quince));

    await mostrar();

    await screen.findByText('Categoría 01');
    expect(etiquetasDeFilas()).toEqual(quince.map((c, i) => `${c.nombre}, $${16 - i}.000`));
    expect(barras()).toHaveLength(15);
    expect(screen.queryByText(/^Otros/)).toBeNull();
    expect(screen.queryByText(/ver todas|ver más/i)).toBeNull();
  });

  it('CA-RF18-36 sin egresos muestra el aviso sencillo, sin filas, subtítulo, NaN ni error', async () => {
    obtener.mockResolvedValue(reporte([], 0));

    await mostrar({ onElegirCategoria: jest.fn() });

    expect(await screen.findByText(TEXTO_VACIO)).toBeOnTheScreen();
    expect(screen.getByText(TITULO)).toBeOnTheScreen();
    expect(filas()).toHaveLength(0);
    expect(barras()).toHaveLength(0);
    expect(screen.queryByText(SUBTITULO)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF18-36 con total en cero cuenta como vacío aunque la lista traiga entradas', async () => {
    obtener.mockResolvedValue(reporte([cat('Alimentación', 0, 0)], 0));

    await mostrar({ onElegirCategoria: jest.fn() });

    expect(await screen.findByText(TEXTO_VACIO)).toBeOnTheScreen();
    expect(filas()).toHaveLength(0);
    expect(barras()).toHaveLength(0);
    expect(screen.queryByText(SUBTITULO)).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });

  it('CA-RF18-37 dos categorías con el mismo nombre se muestran las dos y cada una avisa su propio id', async () => {
    const alElegir = jest.fn();
    obtener.mockResolvedValue(reporte([cat('Otros', 70000, 70, 'id-general'), cat('Otros', 30000, 30, 'id-personal')]));

    await mostrar({ onElegirCategoria: alElegir });

    await screen.findByText('$70.000');
    expect(screen.getByText('$30.000')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Otros, $70.000' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Otros, $30.000' }));
    expect(alElegir).toHaveBeenNthCalledWith(1, 'id-general', 'Otros');
    expect(alElegir).toHaveBeenNthCalledWith(2, 'id-personal', 'Otros');
  });
});

describe('TarjetaEgresosPorCategoria: el periodo', () => {
  it('CA-RF18-38 con mes pide ese mes', async () => {
    await mostrar({ mes: '2026-09' });

    await screen.findByText('Alimentación');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ mes: '2026-09' });
  });

  it('CA-RF18-38 con desde y hasta pide ese rango', async () => {
    await mostrar({ desde: '2026-10-10', hasta: '2026-10-20' });

    await screen.findByText('Alimentación');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0]).toEqual({ desde: '2026-10-10', hasta: '2026-10-20' });
  });

  it('CA-RF18-38 sin periodo pide el reporte sin parámetros y hace una sola consulta', async () => {
    await mostrar();

    await screen.findByText('Alimentación');
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(obtener.mock.calls[0][0] ?? {}).toEqual({});
  });

  it('CA-RF18-39 al cambiar de mes pide el nuevo, muestra la carga (no los datos viejos) y luego los datos nuevos', async () => {
    obtener.mockResolvedValueOnce(reporte([cat('Septiembre', 400000, 100)]));
    const octubre = pendiente<ReporteCategorias>();
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEgresosPorCategoria mes="2026-09" />);
    expect(await screen.findByText('Septiembre')).toBeOnTheScreen();

    await rerender(<TarjetaEgresosPorCategoria mes="2026-10" />);

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ mes: '2026-10' });
    expect(cargando()).toBeOnTheScreen();
    expect(screen.queryByText('Septiembre')).toBeNull();
    expect(filas()).toHaveLength(0);

    await act(async () => octubre.resolver(reporte([cat('Octubre', 900000, 100)])));

    expect(await screen.findByText('Octubre')).toBeOnTheScreen();
    expect(screen.queryByText('Septiembre')).toBeNull();
    expect(cargando()).toBeNull();
  });

  it('CA-RF18-39 al pasar de un mes a un rango vuelve a pedir', async () => {
    const { rerender } = await render(<TarjetaEgresosPorCategoria mes="2026-09" />);
    await screen.findByText('Alimentación');

    await rerender(<TarjetaEgresosPorCategoria desde="2026-10-10" hasta="2026-10-20" />);

    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-10-10', hasta: '2026-10-20' });
  });

  it('CA-RF18-39 al cambiar solo desde o solo hasta vuelve a pedir', async () => {
    const { rerender } = await render(<TarjetaEgresosPorCategoria desde="2026-10-10" hasta="2026-10-20" />);
    await screen.findByText('Alimentación');

    await rerender(<TarjetaEgresosPorCategoria desde="2026-10-11" hasta="2026-10-20" />);
    await screen.findByText('Alimentación');
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(obtener.mock.calls[1][0]).toEqual({ desde: '2026-10-11', hasta: '2026-10-20' });

    await rerender(<TarjetaEgresosPorCategoria desde="2026-10-11" hasta="2026-10-25" />);
    await screen.findByText('Alimentación');
    expect(obtener).toHaveBeenCalledTimes(3);
    expect(obtener.mock.calls[2][0]).toEqual({ desde: '2026-10-11', hasta: '2026-10-25' });
  });

  it('CA-RF18-40 si la respuesta de septiembre llega después que la de octubre, se ignora', async () => {
    const septiembre = pendiente<ReporteCategorias>();
    const octubre = pendiente<ReporteCategorias>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEgresosPorCategoria mes="2026-09" />);
    await rerender(<TarjetaEgresosPorCategoria mes="2026-10" />);

    await act(async () => octubre.resolver(reporte([cat('Octubre', 900000, 100)])));
    await act(async () => septiembre.resolver(reporte([cat('Septiembre', 400000, 100)])));

    expect(await screen.findByText('Octubre')).toBeOnTheScreen();
    expect(screen.queryByText('Septiembre')).toBeNull();
  });

  it('CA-RF18-40 si la respuesta de septiembre llega antes de que octubre responda, no se muestra', async () => {
    const septiembre = pendiente<ReporteCategorias>();
    const octubre = pendiente<ReporteCategorias>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEgresosPorCategoria mes="2026-09" />);
    await rerender(<TarjetaEgresosPorCategoria mes="2026-10" />);
    await act(async () => septiembre.resolver(reporte([cat('Septiembre', 400000, 100)])));

    expect(screen.queryByText('Septiembre')).toBeNull();
    expect(cargando()).toBeOnTheScreen();
  });

  it('CA-RF18-40 un error de la consulta vieja no reemplaza lo que se ve', async () => {
    const septiembre = pendiente<ReporteCategorias>();
    const octubre = pendiente<ReporteCategorias>();
    obtener.mockReturnValueOnce(septiembre.promesa);
    obtener.mockReturnValueOnce(octubre.promesa);

    const { rerender } = await render(<TarjetaEgresosPorCategoria mes="2026-09" />);
    await rerender(<TarjetaEgresosPorCategoria mes="2026-10" />);
    await act(async () => octubre.resolver(reporte([cat('Octubre', 900000, 100)])));
    await act(async () => septiembre.rechazar(new ApiError(500, 'x')));

    expect(await screen.findByText('Octubre')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});
