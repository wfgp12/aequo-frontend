import { act, fireEvent, screen, within } from '@testing-library/react-native';

// Ayudas compartidas por las pruebas de las pantallas de tarjetas y de cargos fijos
// (criterios/05-tarjetas-pantallas.md). No son pruebas: Jest solo corre los archivos *.test.ts(x).

// Mismo formato que valida el backend para Idempotency-Key
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** Para mirar lo que queda detrás de una hoja o de un diálogo abierto. */
export const VER_TODO = { includeHiddenElements: true };

// Palabras que el usuario nunca debe leer (RNF-04)
export const TECNICO =
  /tasaEA|cuotaUnicaSinInteres|tarjetaId|idempoten|payload|cascada|ApiError|NetworkError|internal server|\b(400|404|409|422|500)\b/i;

export function pendiente<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

/** Todos los textos visibles, en el orden en que aparecen en pantalla. */
export function textosEnOrden(nodo: unknown = screen.toJSON(), acumulado: string[] = []): string[] {
  if (typeof nodo === 'string') acumulado.push(nodo);
  else if (Array.isArray(nodo)) nodo.forEach((n) => textosEnOrden(n, acumulado));
  else if (nodo && typeof nodo === 'object' && 'children' in nodo) {
    textosEnOrden((nodo as { children: unknown }).children, acumulado);
  }
  return acumulado;
}

/** Todo el texto de la pantalla en una sola línea (sirve para comparar posiciones sin importar cómo se parta en filas). */
export const textoDePantalla = () => textosEnOrden().join(' | ');

export const boton = (nombre: string, opciones = {}) =>
  screen.getByRole('button', { name: nombre, ...opciones });

/**
 * El botón "Volver" de una hoja: se busca a partir del título de la hoja, porque la pantalla que está debajo
 * también tiene su "Volver".
 */
export function volverDeLaHoja(titulo: string) {
  let nodo = screen.getByText(titulo).parent;
  while (nodo) {
    const botones = within(nodo).queryAllByRole('button', { name: 'Volver' });
    if (botones.length) return botones[botones.length - 1];
    nodo = nodo.parent;
  }
  throw new Error(`No hay un botón "Volver" en la hoja "${titulo}"`);
}

export const interruptor = (nombre: string) => screen.getByRole('switch', { name: nombre });

export function estaEncendido(nombre: string) {
  try {
    expect(interruptor(nombre)).toBeChecked();
    return true;
  } catch {
    return false;
  }
}

/** Toca un interruptor: sirve tanto si es el "Switch" nativo como si es un botón con rol de interruptor. */
export async function alternar(nombre: string) {
  const antes = estaEncendido(nombre);
  await fireEvent(interruptor(nombre), 'valueChange', !antes);
  if (estaEncendido(nombre) === antes) await fireEvent.press(interruptor(nombre));
}

/** El gesto "atrás" del sistema sobre el diálogo que está encima (el último diálogo modal abierto). */
export async function gestoAtras() {
  // En las pruebas, el diálogo modal de React Native es un elemento "Modal" que lleva su onRequestClose
  const modales = screen.container.queryAll((nodo) => nodo.type === 'Modal');
  await act(async () => modales[modales.length - 1].props.onRequestClose());
}
