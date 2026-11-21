import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  listarTarjetas,
} from '@/lib/api/tarjetas';
import { screen } from '@testing-library/react-native';
import {
  CON_CUOTAS,
  dejarHoy,
  fijarHoy,
  hayTexto,
  mostrarDetalle,
  plano,
  proyeccionDe,
  servirDetalle,
  TEXTO,
} from './ayudas/detalle-tarjeta';
import { reiniciarRouter } from './ayudas/router-simulado';

// Detalle de la tarjeta: el total del mes con su desglose, redondeado al peso y sin que la pantalla calcule nada
// (criterios/05-detalle-de-tarjeta.md, CA-RF30-F11, F13 y F14; RNF-11). El backend se simula en el borde del
// adaptador. Hoy es el 19 de noviembre de 2026.
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

describe('Detalle de la tarjeta: "Este mes pagas"', () => {
  it('CA-RF30-F11 muestra el total del mes con las líneas de cuotas y cargos fijos y la nota de que es un estimado', async () => {
    await mostrarDetalle();

    expect(screen.getByText('Este mes pagas')).toBeOnTheScreen();
    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 291.270')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 55.000')).toBeOnTheScreen();
    expect(screen.getByText(TEXTO.notaDelTotal)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA-RF30-F11 el orden en pantalla es el rótulo, el total, el desglose y la nota', async () => {
    await mostrarDetalle();

    const texto = plano();
    const orden = [
      'Este mes pagas',
      '$ 346.270',
      'Cuotas $ 291.270',
      'Cargos fijos $ 55.000',
      TEXTO.notaDelTotal,
    ].map((parte) => texto.indexOf(parte));
    expect(orden.every((posicion) => posicion >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });
});

describe('Detalle de la tarjeta: solo redondea al peso al mostrar (RNF-11)', () => {
  it('CA-RF30-F13 cada monto se ve en pesos enteros con puntos de miles', async () => {
    await mostrarDetalle({
      proyeccion: (mes) =>
        proyeccionDe(mes, {
          cuotas: 291270.05016469,
          cargosFijos: 0.4,
          total: 346270.05016469,
          saldoPendiente: 45900.5,
        }),
    });

    expect(screen.getByText('$ 346.270')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 291.270')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 0')).toBeOnTheScreen();
    expect(screen.getByText('$ 45.901')).toBeOnTheScreen();
  });

  it.each([
    [0.4, '$ 0'],
    [0.5, '$ 1'],
    [45900.5, '$ 45.901'],
    [999999.5, '$ 1.000.000'],
    [1234567.49, '$ 1.234.567'],
    [12345678, '$ 12.345.678'],
  ])('CA-RF30-F13 el total %s se ve como "%s"', async (total, visto) => {
    // Con lo que queda por pagar en otra cifra, para que la tarjeta no cuente como "sin pagos"
    await mostrarDetalle({
      proyeccion: (mes) => proyeccionDe(mes, { total, cuotas: total, saldoPendiente: 7000 }),
    });

    // Con un total de "$ 0" que no es 0 de verdad (0,4), "Este mes has pagado" también dice "$ 0" (CA-RF32-F25)
    expect(screen.getAllByText(visto)[0]).toBeOnTheScreen();
  });

  it('CA-RF30-F13 nunca se ven decimales ni "NaN" en ninguna cifra', async () => {
    await mostrarDetalle();

    const texto = plano();
    expect(texto).not.toMatch(/\$ [\d.]*,/);
    expect(texto).not.toMatch(/\d\.\d{1,2}(?!\d|\.)/);
    expect(texto).not.toMatch(/NaN|undefined|null/);
  });

  it('CA-RF30-F14 muestra exactamente lo que responde el backend aunque las cifras no cuadren entre sí', async () => {
    await mostrarDetalle({
      proyeccion: (mes) =>
        proyeccionDe(mes, {
          cuotas: 100000,
          cargosFijos: 20000,
          total: 150000,
          saldoPendiente: 999999,
        }),
    });

    expect(screen.getByText('$ 150.000')).toBeOnTheScreen();
    expect(screen.getByText('Cuotas $ 100.000')).toBeOnTheScreen();
    expect(screen.getByText('Cargos fijos $ 20.000')).toBeOnTheScreen();
    expect(screen.getByText('$ 999.999')).toBeOnTheScreen();
    expect(hayTexto('$ 120.000')).toBe(false);
  });

  it('CA-RF30-F14 no suma el desglose ni resta lo que queda por pagar: el total es el del backend', async () => {
    await mostrarDetalle({
      proyeccion: (mes) => ({ ...CON_CUOTAS, mes, total: 1000, saldoPendiente: 2000 }),
    });

    expect(screen.getByText('$ 1.000')).toBeOnTheScreen();
    expect(screen.getByText('$ 2.000')).toBeOnTheScreen();
    expect(hayTexto('$ 346.270')).toBe(false);
    expect(hayTexto('$ 1.766.529')).toBe(false);
  });
});
