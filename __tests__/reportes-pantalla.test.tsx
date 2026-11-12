import Reportes from '@/app/reportes';
import { ApiError, NetworkError } from '@/lib/api/client';
import {
  obtenerReporteCategorias,
  obtenerReporteEvolucion,
  obtenerReportePeriodo,
} from '@/lib/api/reportes';
import { fechaLarga, nombreDelMes } from '@/lib/fechas';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Pantalla "Reportes" (criterios/03-reportes-dashboard.md, CA-RF14-01 a 15 y CA-RF20-03 a 11). El backend se simula en
// el borde de los tres adaptadores y la librería de gráficas en el suyo, como en las pruebas de las tarjetas.
// Hoy es el 17 de septiembre de 2026 (reloj simulado): el mes actual es el "Septiembre 2026" del diseño.
const mockBack = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('react-native-gifted-charts', () => {
  const { Text, View } = require('react-native');
  return {
    BarChart: (props: any) => (
      <>
        {props.data.map((d: any, i: number) => (
          <View key={i}>
            {d.topLabelComponent ? d.topLabelComponent() : null}
            <Text>{d.label}</Text>
          </View>
        ))}
      </>
    ),
    LineChart: (props: any) => (
      <>
        {props.data.map((d: any, i: number) => (
          <View key={i}>
            <Text>{d.label}</Text>
          </View>
        ))}
      </>
    ),
  };
});
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock('@/lib/api/reportes', () => ({
  obtenerReportePeriodo: jest.fn(),
  obtenerReporteCategorias: jest.fn(),
  obtenerReporteEvolucion: jest.fn(),
}));

const periodo = obtenerReportePeriodo as jest.Mock;
const categorias = obtenerReporteCategorias as jest.Mock;
const evolucion = obtenerReporteEvolucion as jest.Mock;

type Arg = { mes?: string; desde?: string; hasta?: string } | undefined;

const TEXTO_SERVIDOR = {
  periodo: 'No pudimos cargar tus ingresos y egresos. Inténtalo de nuevo en unos minutos.',
  categorias: 'No pudimos cargar tus egresos por categoría. Inténtalo de nuevo en unos minutos.',
  evolucion: 'No pudimos cargar la evolución de tu balance. Inténtalo de nuevo en unos minutos.',
};
const TEXTO_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const AVISO_FALTA = 'Elige las dos fechas para ver tu reporte.';
const AVISO_INVERTIDO = 'La fecha Desde no puede ser posterior a la fecha Hasta.';
const VACIO = {
  periodo: 'No hay movimientos en este periodo.',
  categorias: 'No hay egresos en este periodo.',
  evolucion: 'No hay movimientos en estos meses.',
};
const CARGANDO = {
  periodo: 'Cargando ingresos y egresos',
  categorias: 'Cargando egresos por categoría',
  evolucion: 'Cargando evolución del balance',
};

// Datos distintos por mes (n = número del mes), para saber de qué mes son las tarjetas que se ven
const numeroDeMes = (a: Arg) => Number((a?.mes ?? a?.hasta ?? '2026-10').slice(5, 7));
const dinero = (n: number) => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const claveDeMes = (a: Arg) => (a?.mes ?? a?.hasta ?? '').slice(0, 7);

const periodoDe = (a: Arg) => {
  const n = numeroDeMes(a);
  return {
    desde: '',
    hasta: '',
    ingresos: n * 100000,
    egresos: n * 50000,
    pagosTarjeta: 0,
    abonosDeuda: 0,
    dineroRecibido: 0,
    balance: n * 50000,
  };
};
const categoriasDe = (a: Arg) => {
  const n = numeroDeMes(a);
  return {
    desde: '',
    hasta: '',
    total: n * 50000,
    categorias: [
      {
        categoriaId: `c${n}`,
        nombre: `Gastos de ${nombreDelMes(n - 1)}`,
        total: n * 50000,
        porcentaje: 100,
      },
    ],
  };
};
const evolucionDe = (a: Arg) => {
  const n = numeroDeMes(a);
  return {
    desde: null,
    hasta: null,
    puntos: Array.from({ length: 6 }, (_, i) => ({
      periodo: `2026-${String(n - 5 + i).padStart(2, '0')}`,
      balance: n * 1000 + i,
    })),
  };
};

// Lo que se ve de un mes de 2026 (de abril a diciembre, para que los 6 meses de la evolución no cambien de año)
const barrasDe = (n: number) =>
  `Ingresos de ${dinero(n * 100000)} y egresos de ${dinero(n * 50000)}`;
const filaDe = (n: number) => `Gastos de ${nombreDelMes(n - 1)}`;
const lineaDe = (n: number) =>
  `Evolución del balance de ${nombreDelMes(n - 6)} a ${nombreDelMes(n - 1)}`;

async function veElMes(n: number) {
  expect(await screen.findByRole('image', { name: barrasDe(n) })).toBeOnTheScreen();
  expect(await screen.findByText(filaDe(n))).toBeOnTheScreen();
  expect(await screen.findByRole('image', { name: lineaDe(n) })).toBeOnTheScreen();
}
function noVeElMes(n: number) {
  expect(screen.queryByRole('image', { name: barrasDe(n) })).toBeNull();
  expect(screen.queryByText(filaDe(n))).toBeNull();
  expect(screen.queryByRole('image', { name: lineaDe(n) })).toBeNull();
}

// Respuestas que el test resuelve cuando quiere, para simular al backend tardando
type Espera = { clave: string; resolver: () => void };
let esperas: Espera[] = [];
function conRespuestasManuales() {
  const poner = (mock: jest.Mock, datos: (a: Arg) => unknown) =>
    mock.mockImplementation(
      (a: Arg) =>
        new Promise((res) => esperas.push({ clave: claveDeMes(a), resolver: () => res(datos(a)) })),
    );
  poner(periodo, periodoDe);
  poner(categorias, categoriasDe);
  poner(evolucion, evolucionDe);
}
/** Responde las consultas pendientes de un mes (YYYY-MM). */
async function responder(mes: string) {
  const mias = esperas.filter((e) => e.clave === mes);
  esperas = esperas.filter((e) => e.clave !== mes);
  await act(async () => mias.forEach((e) => e.resolver()));
}

const llamadas = (mock: jest.Mock) => mock.mock.calls.map((c) => c[0]);
const limpiarLlamadas = () => [periodo, categorias, evolucion].forEach((m) => m.mockClear());

const anterior = () => screen.getByRole('button', { name: 'Mes anterior' });
const siguiente = () => screen.getByRole('button', { name: 'Mes siguiente' });
const pestana = (nombre: 'Mes' | 'Rango') => screen.getByRole('tab', { name: nombre });
const cargando = (tarjeta: keyof typeof CARGANDO) => screen.queryByLabelText(CARGANDO[tarjeta]);

async function irAlMesAnterior(veces = 1) {
  for (let i = 0; i < veces; i++) await fireEvent.press(anterior());
}
async function elegirFecha(campo: 'Desde' | 'Hasta', actual: string, iso: string, mesesAtras = 0) {
  await fireEvent.press(screen.getByLabelText(`${campo}: ${actual}`));
  for (let i = 0; i < mesesAtras; i++) await fireEvent.press(screen.getByLabelText('Mes anterior'));
  await fireEvent.press(screen.getByLabelText(fechaLarga(iso)));
}
async function quitarFecha(campo: 'Desde' | 'Hasta', actual: string) {
  await fireEvent.press(screen.getByLabelText(`${campo}: ${actual}`));
  await fireEvent.press(screen.getByText('Quitar esta fecha'));
}

async function mostrar() {
  await render(<Reportes />);
}
async function mostrarCargado() {
  await mostrar();
  await veElMes(9);
}
async function mostrarEnRango() {
  await mostrarCargado();
  await fireEvent.press(pestana('Rango'));
  await screen.findByRole('image', { name: barrasDe(9) });
}

// Solo se congela la fecha, con una fecha local (no depende de la zona de la máquina)
const NO_FALSEAR = [
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
] as const;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 17, 12), doNotFake: [...NO_FALSEAR] });
  esperas = [];
  mockBack.mockClear();
  periodo.mockReset().mockImplementation(async (a: Arg) => periodoDe(a));
  categorias.mockReset().mockImplementation(async (a: Arg) => categoriasDe(a));
  evolucion.mockReset().mockImplementation(async (a: Arg) => evolucionDe(a));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Reportes: selector de periodo, modo "Mes"', () => {
  it('CA-RF14-01 al entrar muestra el título, las pestañas con "Mes" elegida y el mes actual', async () => {
    await mostrarCargado();

    expect(screen.getByText('Reportes')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mes', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Rango', selected: false })).toBeOnTheScreen();
    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();
    expect(anterior()).toBeOnTheScreen();
    expect(siguiente()).toBeOnTheScreen();
  });

  it('CA-RF14-01 las tres tarjetas piden el mes actual de forma explícita, una consulta cada una', async () => {
    await mostrarCargado();

    expect(llamadas(periodo)).toEqual([{ mes: '2026-09' }]);
    expect(llamadas(categorias)).toEqual([{ mes: '2026-09' }]);
    expect(llamadas(evolucion)).toEqual([{ desde: '2026-04', hasta: '2026-09' }]);
  });

  it('CA-RF14-02 el mes se escribe con su nombre y su año, no como 2026-09', async () => {
    await mostrarCargado();

    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();
    expect(screen.queryByText('2026-09')).toBeNull();
  });

  it('CA-RF14-02 las flechas se anuncian como botones "Mes anterior" y "Mes siguiente"', async () => {
    await mostrarCargado();

    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeOnTheScreen();
  });

  it('CA-RF14-03 "Mes anterior" muestra agosto y las tres tarjetas piden agosto, una consulta nueva cada una', async () => {
    await mostrarCargado();

    await irAlMesAnterior();

    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ mes: '2026-09' }, { mes: '2026-08' }]);
    expect(llamadas(categorias)).toEqual([{ mes: '2026-09' }, { mes: '2026-08' }]);
    expect(llamadas(evolucion)).toEqual([
      { desde: '2026-04', hasta: '2026-09' },
      { desde: '2026-03', hasta: '2026-08' },
    ]);
    expect(screen.getByText('Últimos 6 meses hasta agosto')).toBeOnTheScreen();
    await veElMes(8);
  });

  it('CA-RF14-04 de enero se pasa a diciembre del año anterior', async () => {
    jest.setSystemTime(new Date(2026, 0, 15, 12));
    await mostrar();
    expect(await screen.findByText('Enero 2026')).toBeOnTheScreen();

    await irAlMesAnterior();

    expect(screen.getByText('Diciembre 2025')).toBeOnTheScreen();
    expect(llamadas(periodo)[1]).toEqual({ mes: '2025-12' });
    expect(llamadas(categorias)[1]).toEqual({ mes: '2025-12' });
    expect(llamadas(evolucion)[1]).toEqual({ desde: '2025-07', hasta: '2025-12' });
  });

  it('CA-RF14-05 "Mes siguiente" avanza hasta el mes actual y ahí queda deshabilitado', async () => {
    await mostrarCargado();
    await irAlMesAnterior(2);
    expect(screen.getByText('Julio 2026')).toBeOnTheScreen();
    expect(siguiente()).not.toBeDisabled();

    await fireEvent.press(siguiente());
    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    await fireEvent.press(siguiente());
    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();

    expect(llamadas(periodo).map((a: any) => a.mes)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(llamadas(categorias).map((a: any) => a.mes)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(llamadas(evolucion).map((a: any) => a.hasta)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(siguiente()).toBeDisabled();
  });

  it('CA-RF14-05 tocar "Mes siguiente" deshabilitado no cambia el mes ni consulta', async () => {
    await mostrarCargado();
    limpiarLlamadas();

    await fireEvent.press(siguiente());

    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();
    expect(periodo).not.toHaveBeenCalled();
    expect(categorias).not.toHaveBeenCalled();
    expect(evolucion).not.toHaveBeenCalled();
  });

  it('CA-RF14-06 al cambiar de mes las tres tarjetas muestran su carga y luego, cada una, los datos del nuevo mes', async () => {
    conRespuestasManuales();
    await mostrar();
    await responder('2026-09');
    await veElMes(9);

    await irAlMesAnterior();

    noVeElMes(9);
    expect(cargando('periodo')).toBeOnTheScreen();
    expect(cargando('categorias')).toBeOnTheScreen();
    expect(cargando('evolucion')).toBeOnTheScreen();

    await responder('2026-08');

    await veElMes(8);
    noVeElMes(9);
    expect(cargando('periodo')).toBeNull();
    expect(cargando('categorias')).toBeNull();
    expect(cargando('evolucion')).toBeNull();
  });

  it('CA-RF14-07 con dos toques seguidos se ve julio y la respuesta tardía de agosto no lo pisa', async () => {
    conRespuestasManuales();
    await mostrar();
    await responder('2026-09');
    await veElMes(9);

    await irAlMesAnterior(2);
    expect(screen.getByText('Julio 2026')).toBeOnTheScreen();

    await responder('2026-07');
    await responder('2026-08');

    await veElMes(7);
    noVeElMes(8);
    expect(screen.getByText('Julio 2026')).toBeOnTheScreen();
  });

  it('CA-RF14-07 si agosto responde antes que julio, no se muestra: sigue la carga de julio', async () => {
    conRespuestasManuales();
    await mostrar();
    await responder('2026-09');
    await veElMes(9);

    await irAlMesAnterior(2);
    await responder('2026-08');

    noVeElMes(8);
    expect(cargando('periodo')).toBeOnTheScreen();
    expect(cargando('categorias')).toBeOnTheScreen();
    expect(cargando('evolucion')).toBeOnTheScreen();

    await responder('2026-07');
    await veElMes(7);
  });
});

describe('Reportes: selector de periodo, modo "Rango"', () => {
  it('CA-RF14-08 la pestaña "Rango" muestra Desde y Hasta del primero del mes a hoy, en lugar del selector de mes', async () => {
    await mostrarCargado();

    await fireEvent.press(pestana('Rango'));

    expect(screen.getByRole('tab', { name: 'Rango', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mes', selected: false })).toBeOnTheScreen();
    expect(screen.getByLabelText('Desde: 01/09/2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hasta: 17/09/2026')).toBeOnTheScreen();
    expect(screen.queryByText('Septiembre 2026')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes siguiente' })).toBeNull();
  });

  it('CA-RF14-08 los campos abren un calendario para elegir la fecha', async () => {
    await mostrarEnRango();

    await fireEvent.press(screen.getByLabelText('Desde: 01/09/2026'));

    expect(screen.getByLabelText(fechaLarga('2026-09-10'))).toBeOnTheScreen();
  });

  it('CA-RF14-08 las tarjetas piden el rango inicial', async () => {
    await mostrarEnRango();

    expect(llamadas(periodo)[1]).toEqual({ desde: '2026-09-01', hasta: '2026-09-17' });
    expect(llamadas(categorias)[1]).toEqual({ desde: '2026-09-01', hasta: '2026-09-17' });
  });

  it('CA-RF14-09 en "Rango" las dos primeras tarjetas piden desde y hasta, sin mes', async () => {
    await mostrarEnRango();

    const ultimaPeriodo = llamadas(periodo).at(-1);
    const ultimaCategorias = llamadas(categorias).at(-1);
    expect(ultimaPeriodo).toEqual({ desde: '2026-09-01', hasta: '2026-09-17' });
    expect(ultimaCategorias).toEqual({ desde: '2026-09-01', hasta: '2026-09-17' });
    expect(ultimaPeriodo).not.toHaveProperty('mes');
    expect(ultimaCategorias).not.toHaveProperty('mes');
    expect(await screen.findByText('Ingresos vs egresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos por categoría')).toBeOnTheScreen();
  });

  it('CA-RF14-10 en "Rango" la evolución pide los 6 meses hasta el mes de "Hasta"', async () => {
    await mostrarEnRango();

    await elegirFecha('Desde', '01/09/2026', '2026-07-10', 2);
    await elegirFecha('Hasta', '17/09/2026', '2026-08-20', 1);

    expect(screen.getByLabelText('Desde: 10/07/2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hasta: 20/08/2026')).toBeOnTheScreen();
    expect(llamadas(evolucion).at(-1)).toEqual({ desde: '2026-03', hasta: '2026-08' });
    expect(llamadas(periodo).at(-1)).toEqual({ desde: '2026-07-10', hasta: '2026-08-20' });
    expect(await screen.findByText('Últimos 6 meses hasta agosto')).toBeOnTheScreen();
  });

  it('CA-RF14-11 al elegir otro "Hasta" las dos primeras tarjetas consultan el rango nuevo y muestran su carga', async () => {
    conRespuestasManuales();
    await mostrar();
    await responder('2026-09');
    await fireEvent.press(pestana('Rango'));
    await responder('2026-09');
    await screen.findByRole('image', { name: barrasDe(9) });
    limpiarLlamadas();

    await elegirFecha('Hasta', '17/09/2026', '2026-09-15');

    expect(screen.getByLabelText('Hasta: 15/09/2026')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-15' }]);
    expect(llamadas(categorias)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-15' }]);
    expect(cargando('periodo')).toBeOnTheScreen();
    expect(cargando('categorias')).toBeOnTheScreen();
  });

  it('CA-RF14-11 al elegir otro "Desde" las dos primeras tarjetas consultan el rango nuevo y muestran su carga', async () => {
    conRespuestasManuales();
    await mostrar();
    await responder('2026-09');
    await fireEvent.press(pestana('Rango'));
    await responder('2026-09');
    await screen.findByRole('image', { name: barrasDe(9) });
    limpiarLlamadas();

    await elegirFecha('Desde', '01/09/2026', '2026-09-05');

    expect(screen.getByLabelText('Desde: 05/09/2026')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-05', hasta: '2026-09-17' }]);
    expect(llamadas(categorias)).toEqual([{ desde: '2026-09-05', hasta: '2026-09-17' }]);
    expect(cargando('periodo')).toBeOnTheScreen();
    expect(cargando('categorias')).toBeOnTheScreen();
  });

  it('CA-RF14-11 si "Hasta" cambia de mes, la evolución también consulta, con los 6 meses hasta ese mes', async () => {
    await mostrarEnRango();
    limpiarLlamadas();

    await elegirFecha('Desde', '01/09/2026', '2026-08-05', 1);
    await elegirFecha('Hasta', '17/09/2026', '2026-08-20', 1);

    expect(llamadas(periodo).at(-1)).toEqual({ desde: '2026-08-05', hasta: '2026-08-20' });
    expect(llamadas(categorias).at(-1)).toEqual({ desde: '2026-08-05', hasta: '2026-08-20' });
    expect(llamadas(evolucion).at(-1)).toEqual({ desde: '2026-03', hasta: '2026-08' });
  });

  it.each([['Desde', '01/09/2026'] as const, ['Hasta', '17/09/2026'] as const])(
    'CA-RF14-12 si se quita la fecha %s avisa, quita las tarjetas y no consulta',
    async (campo, actual) => {
      await mostrarEnRango();
      limpiarLlamadas();

      await quitarFecha(campo, actual);

      expect(screen.getByText(AVISO_FALTA)).toBeOnTheScreen();
      expect(screen.queryByText('Ingresos vs egresos')).toBeNull();
      expect(screen.queryByText('Egresos por categoría')).toBeNull();
      expect(screen.queryByText('Evolución del balance')).toBeNull();
      expect(periodo).not.toHaveBeenCalled();
      expect(categorias).not.toHaveBeenCalled();
      expect(evolucion).not.toHaveBeenCalled();
      expect(screen.getByText('Reportes')).toBeOnTheScreen();
    },
  );

  it('CA-RF14-12 al volver a elegir "Desde" quita el aviso y las tarjetas consultan', async () => {
    await mostrarEnRango();
    await quitarFecha('Desde', '01/09/2026');
    limpiarLlamadas();

    await elegirFecha('Desde', 'sin fecha', '2026-09-01');

    expect(screen.queryByText(AVISO_FALTA)).toBeNull();
    expect(await screen.findByText('Ingresos vs egresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos por categoría')).toBeOnTheScreen();
    expect(screen.getByText('Evolución del balance')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-17' }]);
    expect(llamadas(categorias)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-17' }]);
  });

  it('CA-RF14-12 al volver a elegir "Hasta" quita el aviso y las tarjetas consultan', async () => {
    await mostrarEnRango();
    await quitarFecha('Hasta', '17/09/2026');
    limpiarLlamadas();

    await elegirFecha('Hasta', 'sin fecha', '2026-09-17');

    expect(screen.queryByText(AVISO_FALTA)).toBeNull();
    expect(await screen.findByText('Ingresos vs egresos')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-17' }]);
    expect(llamadas(categorias)).toEqual([{ desde: '2026-09-01', hasta: '2026-09-17' }]);
  });

  it('CA-RF14-13 si "Desde" es posterior a "Hasta" avisa, quita las tarjetas y no consulta', async () => {
    await mostrarEnRango();
    limpiarLlamadas();

    await elegirFecha('Desde', '01/09/2026', '2026-09-20');

    expect(screen.getByText(AVISO_INVERTIDO)).toBeOnTheScreen();
    expect(screen.queryByText('Ingresos vs egresos')).toBeNull();
    expect(screen.queryByText('Egresos por categoría')).toBeNull();
    expect(screen.queryByText('Evolución del balance')).toBeNull();
    expect(periodo).not.toHaveBeenCalled();
    expect(categorias).not.toHaveBeenCalled();
    expect(evolucion).not.toHaveBeenCalled();
  });

  it('CA-RF14-13 al corregir la fecha quita el aviso y vuelve a consultar', async () => {
    await mostrarEnRango();
    await elegirFecha('Desde', '01/09/2026', '2026-09-20');
    limpiarLlamadas();

    await elegirFecha('Desde', '20/09/2026', '2026-09-10');

    expect(screen.queryByText(AVISO_INVERTIDO)).toBeNull();
    expect(await screen.findByText('Ingresos vs egresos')).toBeOnTheScreen();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-10', hasta: '2026-09-17' }]);
    expect(llamadas(categorias)).toEqual([{ desde: '2026-09-10', hasta: '2026-09-17' }]);
  });

  it('CA-RF14-13 "Desde" igual a "Hasta" es un rango válido de un solo día', async () => {
    await mostrarEnRango();
    limpiarLlamadas();

    await elegirFecha('Desde', '01/09/2026', '2026-09-17');

    expect(screen.queryByText(AVISO_INVERTIDO)).toBeNull();
    expect(llamadas(periodo)).toEqual([{ desde: '2026-09-17', hasta: '2026-09-17' }]);
  });

  it('CA-RF14-14 al cambiar de pestaña se conserva lo elegido en cada una', async () => {
    await mostrarCargado();
    await irAlMesAnterior(2);
    expect(screen.getByText('Julio 2026')).toBeOnTheScreen();
    await fireEvent.press(pestana('Rango'));
    await elegirFecha('Desde', '01/09/2026', '2026-09-05');

    await fireEvent.press(pestana('Mes'));

    expect(screen.getByText('Julio 2026')).toBeOnTheScreen();
    expect(llamadas(periodo).at(-1)).toEqual({ mes: '2026-07' });
    expect(llamadas(categorias).at(-1)).toEqual({ mes: '2026-07' });
    expect(llamadas(evolucion).at(-1)).toEqual({ desde: '2026-02', hasta: '2026-07' });

    await fireEvent.press(pestana('Rango'));

    expect(screen.getByLabelText('Desde: 05/09/2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hasta: 17/09/2026')).toBeOnTheScreen();
    expect(llamadas(periodo).at(-1)).toEqual({ desde: '2026-09-05', hasta: '2026-09-17' });
  });

  it('CA-RF14-14 al salir y volver a entrar vuelve al mes actual', async () => {
    const primera = await render(<Reportes />);
    await veElMes(9);
    await irAlMesAnterior(2);
    await fireEvent.press(pestana('Rango'));
    await elegirFecha('Desde', '01/09/2026', '2026-09-05');
    await primera.unmount();

    await render(<Reportes />);

    expect(await screen.findByText('Septiembre 2026')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mes', selected: true })).toBeOnTheScreen();
    await fireEvent.press(pestana('Rango'));
    expect(screen.getByLabelText('Desde: 01/09/2026')).toBeOnTheScreen();
  });

  it('CA-RF14-15 "Mes" y "Rango" se anuncian como pestañas, con la elegida marcada', async () => {
    await mostrarCargado();

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Mes', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Rango', selected: false })).toBeOnTheScreen();

    await fireEvent.press(pestana('Rango'));

    expect(screen.getByRole('tab', { name: 'Rango', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Mes', selected: false })).toBeOnTheScreen();
  });
});

describe('Reportes: la vista del reporte', () => {
  it('CA-RF20-03 muestra las tres tarjetas con sus datos, en el orden del diseño y bajo el selector', async () => {
    await mostrarCargado();

    expect(screen.getByText('Últimos 6 meses hasta septiembre')).toBeOnTheScreen();
    const arbol = JSON.stringify(screen.toJSON());
    const posicion = (texto: string) => arbol.indexOf(`"${texto}"`);
    expect(posicion('Septiembre 2026')).toBeGreaterThan(-1);
    expect(posicion('Ingresos vs egresos')).toBeGreaterThan(posicion('Septiembre 2026'));
    expect(posicion('Egresos por categoría')).toBeGreaterThan(posicion('Ingresos vs egresos'));
    expect(posicion('Evolución del balance')).toBeGreaterThan(posicion('Egresos por categoría'));
  });

  it('CA-RF20-03 no dibuja las tarjetas que aún no existen, ni espacios ni avisos de "próximamente"', async () => {
    await mostrarCargado();

    expect(screen.queryByText(/método de pago/i)).toBeNull();
    expect(screen.queryByText(/Presupuesto del mes/i)).toBeNull();
    expect(screen.queryByText(/Deuda total/i)).toBeNull();
    expect(screen.queryByText(/próximamente|pronto/i)).toBeNull();
  });

  it('CA-RF20-04 mientras no responde el backend muestra título, pestañas, selector y la carga de cada tarjeta', async () => {
    conRespuestasManuales();

    await mostrar();

    expect(screen.getByText('Reportes')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('Ingresos vs egresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos por categoría')).toBeOnTheScreen();
    expect(screen.getByText('Evolución del balance')).toBeOnTheScreen();
    expect(cargando('periodo')).toBeOnTheScreen();
    expect(cargando('categorias')).toBeOnTheScreen();
    expect(cargando('evolucion')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(VACIO.periodo)).toBeNull();
    expect(screen.queryByText(VACIO.categorias)).toBeNull();
    expect(screen.queryByText(VACIO.evolucion)).toBeNull();
  });

  it('CA-RF20-04 se puede tocar "Mes anterior" sin esperar a que termine de cargar', async () => {
    conRespuestasManuales();
    await mostrar();

    await irAlMesAnterior();

    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    expect(llamadas(periodo).at(-1)).toEqual({ mes: '2026-08' });
  });

  it.each([
    ['periodo', 'Ingresos vs egresos'],
    ['categorias', 'Egresos por categoría'],
    ['evolucion', 'Evolución del balance'],
  ] as const)(
    'CA-RF20-05 si falla "%s" el aviso sale solo en esa tarjeta (%s)',
    async (cual, titulo) => {
      (({ periodo, categorias, evolucion })[cual] as jest.Mock).mockRejectedValue(
        new ApiError(500, 'Internal server error'),
      );

      await mostrar();

      expect(await screen.findByRole('alert')).toHaveTextContent(TEXTO_SERVIDOR[cual]);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getAllByText('Reintentar')).toHaveLength(1);
      expect(screen.getByText(titulo)).toBeOnTheScreen();
      if (cual !== 'periodo')
        expect(await screen.findByRole('image', { name: barrasDe(9) })).toBeOnTheScreen();
      if (cual !== 'categorias') expect(await screen.findByText(filaDe(9))).toBeOnTheScreen();
      if (cual !== 'evolucion')
        expect(await screen.findByRole('image', { name: lineaDe(9) })).toBeOnTheScreen();
    },
  );

  it('CA-RF20-06 "Reintentar" repite solo la consulta de esa tarjeta, sin tocar a las otras', async () => {
    categorias.mockRejectedValueOnce(new ApiError(500, 'x'));
    await mostrar();
    await screen.findByRole('alert');
    await screen.findByRole('image', { name: barrasDe(9) });
    await screen.findByRole('image', { name: lineaDe(9) });

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(llamadas(categorias)).toEqual([{ mes: '2026-09' }, { mes: '2026-09' }]);
    expect(periodo).toHaveBeenCalledTimes(1);
    expect(evolucion).toHaveBeenCalledTimes(1);
    expect(cargando('periodo')).toBeNull();
    expect(cargando('evolucion')).toBeNull();
    expect(screen.getByRole('image', { name: barrasDe(9) })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: lineaDe(9) })).toBeOnTheScreen();
    expect(await screen.findByText(filaDe(9))).toBeOnTheScreen();
  });

  it('CA-RF20-06 "Reintentar" consulta el periodo que tiene la pantalla en ese momento', async () => {
    categorias.mockRejectedValue(new ApiError(500, 'x'));
    await mostrar();
    await screen.findByRole('alert');

    await irAlMesAnterior();
    await screen.findByRole('alert');
    limpiarLlamadas();
    await fireEvent.press(screen.getByText('Reintentar'));

    expect(llamadas(categorias)).toEqual([{ mes: '2026-08' }]);
    expect(periodo).not.toHaveBeenCalled();
    expect(evolucion).not.toHaveBeenCalled();
  });

  it('CA-RF20-07 sin conexión cada tarjeta lo dice y tiene su "Reintentar", y el selector sigue usable', async () => {
    periodo.mockRejectedValue(new NetworkError());
    categorias.mockRejectedValue(new NetworkError());
    evolucion.mockRejectedValue(new NetworkError());

    await mostrar();

    expect(await screen.findAllByText(TEXTO_RED)).toHaveLength(3);
    expect(screen.getAllByText('Reintentar')).toHaveLength(3);
    expect(screen.queryByText(TEXTO_SERVIDOR.periodo)).toBeNull();
    expect(screen.getByText('Reportes')).toBeOnTheScreen();
    expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();

    await irAlMesAnterior();

    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    expect(llamadas(periodo).at(-1)).toEqual({ mes: '2026-08' });
  });

  it('CA-RF20-08 un mes sin movimientos muestra el aviso de vacío de cada tarjeta, sin gráficas ni errores', async () => {
    periodo.mockResolvedValue({ ...periodoDe(undefined), ingresos: 0, egresos: 0, balance: 0 });
    categorias.mockResolvedValue({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      total: 0,
      categorias: [],
    });
    evolucion.mockResolvedValue({ desde: '2026-04', hasta: '2026-09', puntos: [] });

    await mostrar();

    expect(await screen.findByText(VACIO.periodo)).toBeOnTheScreen();
    expect(await screen.findByText(VACIO.categorias)).toBeOnTheScreen();
    expect(await screen.findByText(VACIO.evolucion)).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(screen.queryByLabelText(/^Cargando/)).toBeNull();
  });

  it('CA-RF20-08 con todo vacío el selector sigue funcionando', async () => {
    periodo.mockResolvedValue({ ...periodoDe(undefined), ingresos: 0, egresos: 0, balance: 0 });
    categorias.mockResolvedValue({
      desde: '2026-09-01',
      hasta: '2026-09-30',
      total: 0,
      categorias: [],
    });
    evolucion.mockResolvedValue({ desde: '2026-04', hasta: '2026-09', puntos: [] });
    await mostrar();
    await screen.findByText(VACIO.evolucion);

    await irAlMesAnterior();

    expect(screen.getByText('Agosto 2026')).toBeOnTheScreen();
    expect(llamadas(periodo).at(-1)).toEqual({ mes: '2026-08' });
    expect(llamadas(categorias).at(-1)).toEqual({ mes: '2026-08' });
    expect(llamadas(evolucion).at(-1)).toEqual({ desde: '2026-03', hasta: '2026-08' });
  });

  it('CA-RF20-09 si solo la evolución viene vacía, las otras dos muestran sus datos', async () => {
    evolucion.mockResolvedValue({ desde: '2026-04', hasta: '2026-09', puntos: [] });

    await mostrar();

    expect(await screen.findByText(VACIO.evolucion)).toBeOnTheScreen();
    expect(await screen.findByRole('image', { name: barrasDe(9) })).toBeOnTheScreen();
    expect(await screen.findByText(filaDe(9))).toBeOnTheScreen();
    expect(screen.queryByText(VACIO.periodo)).toBeNull();
    expect(screen.queryByText(VACIO.categorias)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF20-10 las categorías se leen como texto: sin botones, sin ">" y sin la invitación a tocarlas', async () => {
    await mostrarCargado();

    expect(screen.getByText(filaDe(9))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: new RegExp(filaDe(9)) })).toBeNull();
    expect(screen.queryByText('>')).toBeNull();
    expect(screen.queryByText('Toca una categoría para ver sus movimientos')).toBeNull();
  });

  it('CA-RF20-11 "Volver" regresa a la pantalla anterior', async () => {
    await mostrarCargado();

    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
