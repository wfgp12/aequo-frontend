import { formatearPesos } from '@/lib/dinero';
import { coloresDeGrafica } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { useWindowDimensions } from 'react-native';

/** Un punto ya calculado por el backend: solo se presenta. */
export type PuntoGrafica = {
  etiqueta: string;
  valor: number;
  /** Color propio de la barra; si falta, se usa el acento. */
  color?: string;
};

const MARGEN = 48;
const ANCHO_MAXIMO = 640;
export const ANCHO_EJE_Y = 72;

export const pesos = (valor: number) => `$${formatearPesos(valor)}`;

/**
 * Colores reales según el modo del sistema y un ancho que cabe en pantalla (móvil y web).
 * `margenExtra` descuenta el relleno del contenedor (por ejemplo, una tarjeta) para que la gráfica no se desborde.
 */
export function useTemaGrafica(margenExtra = 0) {
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  return {
    colores: coloresDeGrafica(colorScheme),
    ancho: Math.min(width - MARGEN - margenExtra, ANCHO_MAXIMO),
  };
}
