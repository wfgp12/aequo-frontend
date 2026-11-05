import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';

// Paleta Aequo (ADR-010). Debe coincidir con las variables de global.css.
const PALETTE = {
  white: '#FFFFFF',
  yellow: '#FFD300',
  gray: '#757B81',
  graphite: '#262B32',
  black: '#090C11',
};

/** Colores reales (no clases) para las gráficas SVG, que no leen las variables de global.css. */
export function coloresDeGrafica(esquema: 'light' | 'dark' | null | undefined) {
  const oscuro = esquema === 'dark';
  return {
    acento: PALETTE.yellow,
    textoSecundario: oscuro ? '#A6A9AE' : PALETTE.gray,
    lineas: oscuro ? PALETTE.graphite : '#E3E4E6',
    fondo: oscuro ? PALETTE.black : PALETTE.white,
    // Los segmentos de la dona se turnan entre estos tonos de la paleta
    serie: [PALETTE.yellow, oscuro ? PALETTE.white : PALETTE.graphite, PALETTE.gray],
  };
}

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: PALETTE.white,
      border: '#E3E4E6',
      card: PALETTE.white,
      notification: '#EF4444',
      primary: PALETTE.yellow,
      text: PALETTE.black,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: PALETTE.black,
      border: PALETTE.graphite,
      card: PALETTE.graphite,
      notification: '#EF4444',
      primary: PALETTE.yellow,
      text: PALETTE.white,
    },
  },
};
