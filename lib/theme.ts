import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';

// Paleta Aequo (ADR-010). Debe coincidir con las variables de global.css.
const PALETTE = {
  white: '#FFFFFF',
  yellow: '#FFD300',
  gray: '#757B81',
  graphite: '#262B32',
  black: '#090C11',
};

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
