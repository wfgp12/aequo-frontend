import { mesActual, mesCorto, restarMeses } from '@/lib/fechas';

// Utilidades de presentación de la tarjeta "Evolución del balance" (criterios/03-reportes-evolucion.md):
// etiquetas de mes (CA-RF19-25), ventana de 6 meses (CA-RF19-38 y 39) y mes actual del dispositivo (CA-RF19-40).
describe('mesCorto', () => {
  it('CA-RF19-25 abrevia los doce meses en minúscula y sin año', () => {
    const meses = Array.from({ length: 12 }, (_, i) => mesCorto(`2026-${String(i + 1).padStart(2, '0')}`));

    expect(meses).toEqual(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);
  });

  it('CA-RF19-25 no depende del año', () => {
    expect(mesCorto('2025-12')).toBe('dic');
    expect(mesCorto('2031-01')).toBe('ene');
  });
});

describe('restarMeses', () => {
  it('CA-RF19-38 retrocede 5 meses dentro del mismo año', () => {
    expect(restarMeses('2026-09', 5)).toBe('2026-04');
    expect(restarMeses('2026-06', 5)).toBe('2026-01');
    expect(restarMeses('2026-12', 5)).toBe('2026-07');
  });

  it('CA-RF19-39 al cruzar el año retrocede al año anterior', () => {
    expect(restarMeses('2026-02', 5)).toBe('2025-09');
    expect(restarMeses('2026-01', 5)).toBe('2025-08');
    expect(restarMeses('2026-05', 5)).toBe('2025-12');
  });

  it('CA-RF19-38 restar cero meses deja el mismo mes', () => {
    expect(restarMeses('2026-09', 0)).toBe('2026-09');
  });
});

describe('mesActual', () => {
  it('CA-RF19-40 es el mes de la fecha local recibida, en YYYY-MM', () => {
    expect(mesActual(new Date(2026, 10, 15, 12))).toBe('2026-11');
    expect(mesActual(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
    expect(mesActual(new Date(2026, 11, 31, 23, 30))).toBe('2026-12');
  });
});
