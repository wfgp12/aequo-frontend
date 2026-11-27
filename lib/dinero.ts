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

/** "$ 250.000" o "-$ 250.000": se redondea al peso solo al mostrar y un cero nunca lleva signo. */
export function pesosConSigno(valor: number) {
  const redondeado = Math.round(valor);
  return `${redondeado < 0 ? '-' : ''}$ ${formatearPesos(Math.abs(redondeado))}`;
}
