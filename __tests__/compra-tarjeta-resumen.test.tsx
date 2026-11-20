import Registrar from '@/app/registrar';
import { listarCategorias } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { listarTarjetas, obtenerCuotaPrevia, registrarCompra } from '@/lib/api/tarjetas';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  ALIMENTACION,
  llegarAlResumen,
  AMEX_T,
  atras,
  cuotaDe,
  dejarReloj,
  elegirCuotas,
  hastaCuotas,
  hastaFecha,
  hastaResumen,
  OPCION,
  plano,
  TECNICO,
  TEXTO,
  usarReloj,
  VISA_T,
} from './ayudas/compra-tarjeta';
import { RED } from './ayudas/tarjetas';

// Resumen de la compra con tarjeta antes de guardar (criterios/05-compra-con-tarjeta.md, CA-RF27-F17 a F19 y la
// parte del resumen de CA-RF26-F26). Hoy es el 19 de noviembre de 2026 (reloj simulado).
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({ tipo: 'EGRESO' }),
  Redirect: () => null,
}));
jest.mock('@/lib/api/categorias', () => ({
  ...jest.requireActual('@/lib/api/categorias'),
  listarCategorias: jest.fn(),
}));
jest.mock('@/lib/api/tarjetas', () => ({
  ...jest.requireActual('@/lib/api/tarjetas'),
  listarTarjetas: jest.fn(),
  crearTarjeta: jest.fn(),
  obtenerCuotaPrevia: jest.fn(),
  registrarCompra: jest.fn(),
  registrarAvance: jest.fn(),
}));
jest.mock('@/lib/api/transacciones', () => ({
  ...jest.requireActual('@/lib/api/transacciones'),
  crearTransaccion: jest.fn(),
}));

const listar = jest.mocked(listarTarjetas);
const cuotaPrevia = jest.mocked(obtenerCuotaPrevia);
const comprar = jest.mocked(registrarCompra);
const categorias = jest.mocked(listarCategorias);

beforeEach(() => {
  usarReloj();
  categorias.mockReset().mockResolvedValue([ALIMENTACION]);
  listar.mockReset().mockResolvedValue([AMEX_T, VISA_T]);
  comprar.mockReset();
});

afterEach(() => {
  dejarReloj();
});

describe('Resumen de la compra con tarjeta', () => {
  it('CA-RF27-F17 muestra el valor, la categoría, el método, la fecha, la tarjeta, las cuotas, la cuota estimada y los meses del primer y del último pago', async () => {
    await llegarAlResumen();

    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(screen.getByText('Resumen')).toBeOnTheScreen();
    const texto = plano();
    expect(texto).toContain('Valor $ 1.254.700');
    expect(texto).toContain('Categoría Alimentación');
    expect(texto).toContain('Método Tarjeta crédito');
    expect(texto).toContain('Fecha Hoy');
    expect(texto).toContain('Tarjeta Visa Bancolombia');
    expect(texto).toContain('Cuotas 12 cuotas');
    expect(texto).toContain('Cuota estimada $ 119.802');
    expect(texto).toContain('Primer pago diciembre 2026');
    expect(texto).toContain('Último pago noviembre 2027');
    expect(texto.indexOf('Método Tarjeta crédito')).toBeLessThan(
      texto.indexOf('Tarjeta Visa Bancolombia'),
    );
    expect(screen.getByText(TEXTO.nota)).toBeOnTheScreen();
  });

  it.each([
    ['2027-01', 'enero 2027'],
    ['2026-12', 'diciembre 2026'],
    ['2028-05', 'mayo 2028'],
  ])(
    'CA-RF27-F17 el último pago "%s" se escribe "%s", tal como lo respondió el backend',
    async (mesUltimoPago, escrito) => {
      await llegarAlResumen({ respuesta: cuotaDe(119802.1331718775, mesUltimoPago) });

      expect(plano()).toContain(`Último pago ${escrito}`);
    },
  );

  it('CA-RF27-F17 el primer pago se escribe con el mes elegido, también al cambiar de año', async () => {
    await llegarAlResumen({ meses: 2, respuesta: cuotaDe(119802.1331718775, '2028-01') });

    expect(plano()).toContain('Primer pago enero 2027');
  });

  it('CA-RF27-F17 el último pago es el que respondió el backend, no uno deducido sumando meses', async () => {
    await llegarAlResumen({ respuesta: cuotaDe(119802.1331718775, '2031-03') });

    expect(plano()).toContain('Último pago marzo 2031');
    expect(plano()).not.toContain('noviembre 2027');
  });

  it('CA-RF27-F18 con una cuota también muestra la cuota y el último pago', async () => {
    await llegarAlResumen({
      tarjeta: OPCION.amex,
      valor: '80000',
      cuotas: 1,
      meses: 0,
      respuesta: cuotaDe(80000, '2026-11', { cuotaUnicaSinInteres: true, tasaEAAplicada: 0.2421 }),
    });

    const texto = plano();
    expect(texto).toContain('Valor $ 80.000');
    expect(texto).toContain('Tarjeta Amex');
    expect(texto).toContain('Cuotas 1 cuota');
    expect(texto).not.toContain('1 cuotas');
    expect(texto).toContain('Cuota estimada $ 80.000');
    expect(texto).toContain('Primer pago noviembre 2026');
    expect(texto).toContain('Último pago noviembre 2026');
  });

  it('CA-RF27-F19 si vuelve y cambia las cuotas, el resumen muestra la estimación nueva y nada de la anterior', async () => {
    await llegarAlResumen();
    expect(plano()).toContain('Cuotas 12 cuotas');

    await fireEvent.press(atras());
    await screen.findByText('¿Cuándo fue?');
    await fireEvent.press(atras());
    await screen.findByText('¿Cuántas cuotas?');
    cuotaPrevia.mockResolvedValue(cuotaDe(215000.7, '2027-05'));
    await elegirCuotas(6);
    await hastaFecha();
    await hastaResumen();

    const texto = plano();
    expect(texto).toContain('Cuotas 6 cuotas');
    expect(texto).toContain('Cuota estimada $ 215.001');
    expect(texto).toContain('Último pago mayo 2027');
    expect(texto).not.toContain('12 cuotas');
    expect(texto).not.toContain('119.802');
    expect(texto).not.toContain('noviembre 2027');
  });
});

describe('Resumen de la compra con tarjeta: lenguaje y accesibilidad', () => {
  it('CA-RF26-F26 los pasos de cuotas, fecha y resumen hablan de tarjeta, cuotas, cuota estimada, primer pago y último pago, sin términos técnicos', async () => {
    cuotaPrevia.mockReset().mockResolvedValue(cuotaDe(119802.1331718775, '2027-11'));
    await render(<Registrar />);
    await hastaCuotas();
    expect(plano()).not.toMatch(TECNICO);
    await elegirCuotas(12);
    expect(plano()).not.toMatch(TECNICO);
    await hastaFecha();
    expect(plano()).not.toMatch(TECNICO);
    await hastaResumen();

    expect(plano()).not.toMatch(TECNICO);
    expect(plano()).toMatch(/Tarjeta/);
    expect(plano()).toMatch(/cuotas/);
    expect(plano()).toMatch(/Cuota estimada/);
    expect(plano()).toMatch(/Primer pago/);
    expect(plano()).toMatch(/Último pago/);
  });

  it('CA-RF26-F26 los avisos de la cuota estimada se anuncian como alerta y no usan términos técnicos', async () => {
    cuotaPrevia.mockReset().mockRejectedValueOnce(new ApiError(500, 'x'));
    await render(<Registrar />);
    await hastaCuotas();

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTO.errorCuota);
    expect(plano()).not.toMatch(TECNICO);

    cuotaPrevia.mockRejectedValueOnce(new NetworkError());
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(RED);
    expect(plano()).not.toMatch(TECNICO);
  });

  it('CA-RF26-F26 las opciones de cuotas se anuncian como "1 cuota", "3 cuotas", "6 cuotas", "12 cuotas" y "Otra", con su estado, y el selector del mes con "Mes anterior" y "Mes siguiente"', async () => {
    cuotaPrevia.mockReset().mockResolvedValue(cuotaDe(5000));
    await render(<Registrar />);
    await hastaCuotas();

    for (const nombre of ['1 cuota', '3 cuotas', '6 cuotas', '12 cuotas', 'Otra']) {
      expect(screen.getByRole('button', { name: nombre })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: '1 cuota' })).toBeSelected();
    expect(screen.getByRole('button', { name: '3 cuotas' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Otra' }));
    expect(screen.getByRole('button', { name: 'Otra' })).toBeSelected();
    expect(screen.getByLabelText('Número de cuotas')).toBeOnTheScreen();
  });
});
