import { formatearPesos, soloDigitos } from '@/lib/dinero';
import {
  aFechaIso,
  ayer,
  desdeFechaIso,
  fechaCorta,
  fechaLarga,
  hoy,
  nombreDelMes,
} from '@/lib/fechas';

describe('dinero', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1.000'],
    [45000, '45.000'],
    [1254700, '1.254.700'],
    [999999999999, '999.999.999.999'],
  ])('formatea %i como %s', (valor, esperado) => {
    expect(formatearPesos(valor)).toBe(esperado);
  });

  it('redondea al peso al mostrar', () => {
    expect(formatearPesos(1250.6)).toBe('1.251');
  });

  it('soloDigitos deja solo los números', () => {
    expect(soloDigitos('$ 45.000,50 COP')).toBe('4500050');
    expect(soloDigitos('abc')).toBe('');
  });
});

describe('fechas', () => {
  const ahora = new Date(2026, 8, 17, 15, 30); // 17 de septiembre de 2026, hora local

  it('hoy y ayer salen en formato YYYY-MM-DD con la fecha local', () => {
    expect(hoy(ahora)).toBe('2026-09-17');
    expect(ayer(ahora)).toBe('2026-09-16');
  });

  it('ayer cruza el cambio de mes y de año', () => {
    expect(ayer(new Date(2026, 9, 1, 8))).toBe('2026-09-30');
    expect(ayer(new Date(2027, 0, 1, 8))).toBe('2026-12-31');
  });

  it('a la medianoche sigue siendo el mismo día local', () => {
    expect(hoy(new Date(2026, 8, 17, 0, 0, 1))).toBe('2026-09-17');
    expect(hoy(new Date(2026, 8, 17, 23, 59, 59))).toBe('2026-09-17');
  });

  it('desdeFechaIso y aFechaIso son inversas', () => {
    expect(aFechaIso(desdeFechaIso('2026-02-28'))).toBe('2026-02-28');
    expect(aFechaIso(desdeFechaIso('2028-02-29'))).toBe('2028-02-29');
  });

  it('fechaLarga incluye el día de la semana', () => {
    expect(fechaLarga('2026-09-17')).toBe('jueves, 17 de septiembre de 2026');
  });

  it('fechaCorta usa Hoy, Ayer o la fecha completa', () => {
    expect(fechaCorta('2026-09-17', ahora)).toBe('Hoy');
    expect(fechaCorta('2026-09-16', ahora)).toBe('Ayer');
    expect(fechaCorta('2026-08-03', ahora)).toBe('3 de agosto de 2026');
  });

  it('nombreDelMes empieza en enero', () => {
    expect(nombreDelMes(0)).toBe('enero');
    expect(nombreDelMes(11)).toBe('diciembre');
  });
});
