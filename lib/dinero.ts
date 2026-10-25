/** Deja solo los dígitos de un texto: el monto se captura en pesos enteros. */
export function soloDigitos(texto: string) {
  return texto.replace(/\D/g, '');
}

/** Pesos con separador de miles, como en el diseño ("45.000"). El cálculo viene del backend; aquí solo se presenta. */
export function formatearPesos(valor: number) {
  return Math.round(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
