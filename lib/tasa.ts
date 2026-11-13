// La tasa viaja como fracción (0.2921) y la persona la escribe como porcentaje (29,21). La conversión es de
// presentación (RNF-11) y debe ser exacta: se hace sobre el texto decimal, no multiplicando en coma flotante
// (57 * 0.01 daría 0.5700000000000001).

// Decimales de la fracción que se conservan al mostrarla: elimina el ruido de coma flotante (0.1 + 0.2)
const DECIMALES_FRACCION = 10;

/** "29,21" o "29.21" → 0.2921 exacto; null si el texto no es un número. */
export function porcentajeAFraccion(texto: string): number | null {
  const [entero = '', decimales = ''] = texto.replace(',', '.').split('.');
  if (!/^\d*$/.test(entero + decimales) || entero + decimales === '') return null;
  return Number(`${entero || '0'}.${decimales || '0'}e-2`);
}

/** 0.2921 → "29,21": coma decimal y sin ceros de más ("7", no "7,00"). */
export function fraccionAPorcentaje(fraccion: number): string {
  const [entero, decimales] = fraccion.toFixed(DECIMALES_FRACCION).split('.');
  const porcentaje = `${entero}${decimales.slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const resto = decimales.slice(2).replace(/0+$/, '');
  return resto ? `${porcentaje},${resto}` : porcentaje;
}
