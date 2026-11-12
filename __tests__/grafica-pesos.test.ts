import { pesos } from '@/components/graficas/use-tema-grafica';

// Formato de pesos de las gráficas con negativos (criterios/03-reportes-evolucion.md, CA-RF19-29)
describe('pesos (formato de las gráficas)', () => {
  it('CA-RF19-29 escribe los negativos con el signo menos antes del signo de pesos', () => {
    expect(pesos(-1500000)).toBe('-$1.500.000');
    expect(pesos(-250000.6)).toBe('-$250.001');
    expect(pesos(-1234.6)).toBe('-$1.235');
    expect(pesos(-250000)).toBe('-$250.000');
  });

  it('CA-RF19-29 un valor que se redondea a cero no lleva signo', () => {
    expect(pesos(-0.4)).toBe('$0');
    expect(pesos(0)).toBe('$0');
  });

  it('CA-RF19-29 los positivos siguen igual', () => {
    expect(pesos(1200000)).toBe('$1.200.000');
    expect(pesos(1234.6)).toBe('$1.235');
    expect(pesos(500)).toBe('$500');
  });
});
