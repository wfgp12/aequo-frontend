import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
  type MesProyectado,
} from '@/lib/api/tarjetas';
import { screen } from '@testing-library/react-native';
import {
  ANTES_DEL_PRIMER_PAGO,
  CON_CUOTAS,
  dejarHoy,
  fijarHoy,
  filasDeMeses,
  hayTexto,
  mes,
  mostrarDetalle,
  plano,
  servirDetalle,
  SOLO_CARGOS,
  TEXTO,
} from './ayudas/detalle-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';

// Detalle de la tarjeta: lo que queda por pagar y los meses siguientes (criterios/05-detalle-de-tarjeta.md,
// CA-RF31-F01 y F03 a F07 y F09). El cambio de mes (F02 y F08) está en detalle-tarjeta-meses.test.tsx. El backend
// se simula en el borde del adaptador. Hoy es el 19 de noviembre de 2026.
jest.mock('expo-router', () => require('./ayudas/router-simulado').expoRouterSimulado());
jest.mock('@/lib/api/tarjetas', () => ({
  listarTarjetas: jest.fn(),
  obtenerTarjeta: jest.fn(),
  obtenerProyeccion: jest.fn(),
  crearTarjeta: jest.fn(),
  actualizarTarjeta: jest.fn(),
  eliminarTarjeta: jest.fn(),
  listarPagos: jest.fn(),
  registrarPago: jest.fn(),
  eliminarPago: jest.fn(),
}));

beforeEach(() => {
  fijarHoy();
  reiniciarRouter();
  jest.mocked(listarTarjetas).mockReset();
  jest.mocked(crearTarjeta).mockReset();
  jest.mocked(actualizarTarjeta).mockReset();
  jest.mocked(eliminarTarjeta).mockReset();
  servirDetalle();
});
afterEach(() => dejarHoy());

const NOMBRES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/** `cantidad` meses seguidos desde `desde` (YYYY-MM), con cuotas y cargos fijos iguales en todos. */
function mesesSeguidos(desde: string, cantidad: number): MesProyectado[] {
  const [anio, numero] = desde.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const indice = anio * 12 + (numero - 1) + i;
    const periodo = `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
    return mes(periodo, 100000, 20000, 120000, 0);
  });
}
const enLetras = (periodo: string) =>
  `${NOMBRES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;

describe('Detalle de la tarjeta: "Te queda por pagar después de este mes"', () => {
  it('CA-RF31-F01 muestra lo que queda por pagar redondeado al peso y la nota de que son cuotas con intereses, sin cargos fijos', async () => {
    await mostrarDetalle();

    expect(screen.getByText('Te queda por pagar después de este mes')).toBeOnTheScreen();
    expect(screen.getByText('$ 1.766.529')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.notaDelSaldo)).toBeOnTheScreen();
  });

  it('CA-RF31-F01 con "$ 0" por pagar muestra el mismo bloque con "$ 0"', async () => {
    await mostrarDetalle({ proyeccion: (periodo) => ({ ...SOLO_CARGOS, mes: periodo }) });

    expect(screen.getByText('Te queda por pagar después de este mes')).toBeOnTheScreen();
    expect(screen.getByLabelText('Te queda por pagar después de este mes, $ 0')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.notaDelSaldo)).toBeOnTheScreen();
  });

  it('CA-RF31-F01 en el mes antes del primer pago muestra "$ 1.437.626" por pagar', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => ({ ...ANTES_DEL_PRIMER_PAGO, mes: periodo }),
    });

    expect(screen.getByText('$ 1.437.626')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Te queda por pagar después de este mes, $ 1.437.626'),
    ).toBeOnTheScreen();
  });

  it('CA-RF31-F01 lo que queda por pagar es el del backend, no la suma de las filas de abajo', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => ({ ...CON_CUOTAS, mes: periodo, saldoPendiente: 4321 }),
    });

    expect(screen.getByText('$ 4.321')).toBeOnTheScreen();
    expect(hayTexto('$ 1.766.529')).toBe(false);
  });
});

describe('Detalle de la tarjeta: "Próximos meses"', () => {
  it('CA-RF31-F03 muestra el encabezado y una fila por mes, en el mismo orden en que llegaron', async () => {
    await mostrarDetalle();

    expect(screen.getByText('Próximos meses')).toBeOnTheScreen();
    expect(screen.getByText('diciembre 2026')).toBeOnTheScreen();
    expect(screen.getByText('$ 264.543')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 209.543 · Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(screen.getByText('febrero 2027')).toBeOnTheScreen();
    expect(screen.getAllByText('$ 174.802')).toHaveLength(2);
    expect(screen.getAllByText('Cuotas $ 119.802 · Cargos fijos $ 55.000')).toHaveLength(2);
    const texto = plano();
    expect(texto.indexOf('Próximos meses')).toBeLessThan(texto.indexOf('diciembre 2026'));
    expect(texto.indexOf('diciembre 2026')).toBeLessThan(texto.indexOf('enero 2027'));
    expect(texto.indexOf('enero 2027')).toBeLessThan(texto.indexOf('febrero 2027'));
    expect(filasDeMeses()).toHaveLength(3);
  });

  it('CA-RF31-F03 no reordena: si el backend manda los meses en otro orden, se ven en ese orden', async () => {
    const [dic, ene, feb] = CON_CUOTAS.proyeccion;
    await mostrarDetalle({
      proyeccion: (periodo) => ({ ...CON_CUOTAS, mes: periodo, proyeccion: [feb, dic, ene] }),
    });

    expect(filasDeMeses().map((fila) => fila.split(',')[0])).toEqual([
      'febrero 2027',
      'diciembre 2026',
      'enero 2027',
    ]);
  });

  it('CA-RF31-F03 no hay una fila del mes de referencia, ni un total de todos los meses, ni vencimientos', async () => {
    await mostrarDetalle();

    // "noviembre 2026" solo está en el selector: el mes de referencia ya está arriba, en "Este mes pagas"
    expect(screen.getAllByText('noviembre 2026')).toHaveLength(1);
    expect(filasDeMeses().some((fila) => fila.startsWith('noviembre 2026'))).toBe(false);
    expect(plano()).not.toMatch(/vence|vencimiento|todos los meses|suma de los meses/i);
    // Las cifras por mes del backend que no se piden en este paquete tampoco se muestran
    expect(hayTexto('$ 239.604')).toBe(false);
    expect(hayTexto('$ 119.802')).toBe(false);
  });

  it('CA-RF31-F04 cada fila se redondea al peso y no calcula nada: muestra el total que manda el backend', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => ({
        ...CON_CUOTAS,
        mes: periodo,
        proyeccion: [
          mes('2026-12', 209543.21823395, 55000, 264543.21823395, 0),
          mes('2027-01', 100000, 20000, 150000, 0),
        ],
      }),
    });

    expect(screen.getByText('$ 264.543')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 209.543 · Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('$ 150.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 100.000 · Cargos fijos $ 20.000')).toBeOnTheScreen();
    expect(hayTexto('$ 120.000')).toBe(false);
    const texto = plano();
    expect(texto).not.toMatch(/\$ [\d.]*,/);
    expect(texto).not.toMatch(/NaN/);
  });

  it('CA-RF31-F05 un mes sin cuotas entre medias no se omite, y un mes todo en cero se ve con "$ 0"', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => ({
        ...CON_CUOTAS,
        mes: periodo,
        proyeccion: [
          mes('2027-01', 0, 55000, 55000, 83478.247168),
          mes('2027-02', 83478.247168, 55000, 138478.247168, 0),
          mes('2027-03', 0, 0, 0, 0),
        ],
      }),
    });

    expect(filasDeMeses()).toEqual([
      'enero 2027, total $ 55.000',
      'febrero 2027, total $ 138.478',
      'marzo 2027, total $ 0',
    ]);
    expect(screen.getByText('enero 2027')).toBeOnTheScreen();
    expect(screen.getByText('$ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 0 · Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 83.478 · Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText('marzo 2027')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 0 · Cargos fijos $ 0')).toBeOnTheScreen();
  });

  it('CA-RF31-F06 sin meses siguientes no hay encabezado, ni filas, ni aviso de "sin meses"; lo demás sigue visible', async () => {
    await mostrarDetalle({ proyeccion: (periodo) => ({ ...SOLO_CARGOS, mes: periodo }) });

    expect(screen.queryByText('Próximos meses')).toBeNull();
    expect(filasDeMeses()).toEqual([]);
    expect(plano()).not.toMatch(/sin meses|no hay meses|próximos/i);
    expect(screen.getByText(TEXTO.esteMes)).toBeOnTheScreen();
    expect(screen.getByText('$ 55.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.porPagarEsteMes)).toBeOnTheScreen();
  });

  it('CA-RF31-F07 una lista larga se ve completa, sin paginar: 60 filas de diciembre 2026 a noviembre 2031', async () => {
    await mostrarDetalle({
      proyeccion: (periodo) => ({
        ...CON_CUOTAS,
        mes: periodo,
        proyeccion: mesesSeguidos('2026-12', 60),
      }),
    });

    const filas = filasDeMeses();
    expect(filas).toHaveLength(60);
    expect(filas[0]).toBe('diciembre 2026, total $ 120.000');
    expect(filas[1]).toBe('enero 2027, total $ 120.000');
    expect(filas[59]).toBe('noviembre 2031, total $ 120.000');
    expect(filas.map((fila) => fila.split(',')[0])).toEqual(
      mesesSeguidos('2026-12', 60).map((m) => enLetras(m.mes)),
    );
    expect(plano()).not.toMatch(/ver más|ver menos|cargar más|siguiente página/i);
    expect(screen.queryByRole('button', { name: /ver más|más meses/i })).toBeNull();
  });

  it('CA-RF31-F09 cada fila se anuncia como una sola frase con su mes y su total, en el orden de la lista', async () => {
    await mostrarDetalle();

    expect(screen.getByLabelText('diciembre 2026, total $ 264.543')).toBeOnTheScreen();
    expect(screen.getByLabelText('enero 2027, total $ 174.802')).toBeOnTheScreen();
    expect(screen.getByLabelText('febrero 2027, total $ 174.802')).toBeOnTheScreen();
    expect(filasDeMeses()).toEqual([
      'diciembre 2026, total $ 264.543',
      'enero 2027, total $ 174.802',
      'febrero 2027, total $ 174.802',
    ]);
    expect(screen.getByText('Próximos meses')).toBeOnTheScreen();
  });

  it('CA-RF31-F03 las filas no son botones: no se tocan', async () => {
    await mostrarDetalle();

    expect(screen.queryByRole('button', { name: /^diciembre 2026, total/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^enero 2027, total/ })).toBeNull();
  });
});
