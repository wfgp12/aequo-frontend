import { coloresDeGrafica } from '@/lib/theme';

describe('coloresDeGrafica', () => {
  it('CA-RF17-09 devuelve los colores del modo claro y del oscuro', () => {
    expect(coloresDeGrafica('light')).toEqual({
      acento: '#FFD300',
      textoSecundario: '#757B81',
      lineas: '#E3E4E6',
      fondo: '#FFFFFF',
      serie: ['#FFD300', '#262B32', '#757B81'],
    });
    expect(coloresDeGrafica('dark')).toEqual({
      acento: '#FFD300',
      textoSecundario: '#A6A9AE',
      lineas: '#262B32',
      fondo: '#090C11',
      serie: ['#FFD300', '#FFFFFF', '#757B81'],
    });
  });

  it('CA-RF17-10 sin modo definido usa los colores del modo claro', () => {
    expect(coloresDeGrafica(null)).toEqual(coloresDeGrafica('light'));
    expect(coloresDeGrafica(undefined)).toEqual(coloresDeGrafica('light'));
  });
});
