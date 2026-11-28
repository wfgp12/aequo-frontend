import { ApiError, NetworkError } from '@/lib/api/client';

export const ERROR_RED =
  'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** El backend respondió con ese código de estado. */
export const esApi = (e: unknown, status: number) => e instanceof ApiError && e.status === status;

export const tieneCodigo = (e: unknown, code: string) => e instanceof ApiError && e.code === code;

/** Un caso que la pantalla conoce: ese estado, sin `code` (se decide por el estado) o con uno de los esperados. */
export const esCaso = (e: unknown, status: number, ...codes: string[]) =>
  e instanceof ApiError && e.status === status && (!e.code || codes.includes(e.code));

/** Lo pedido ya no existe. Una dirección que no existe también es un 404, pero no significa que algo se borró. */
export const yaNoExiste = (e: unknown) => esApi(e, 404) && !tieneCodigo(e, 'RUTA_NO_ENCONTRADA');

/** La clave de idempotencia ya se usó con otros datos: el siguiente intento necesita una nueva. */
export const claveGastada = (e: unknown) => tieneCodigo(e, 'IDEMPOTENCIA_CLAVE_REUTILIZADA');

/** El primer intento de crear sigue en proceso. `cosa`: "movimiento", "tarjeta", "meta"... */
export const textoEnProceso = (cosa: string) =>
  `Tu ${cosa} todavía se está guardando. Espera unos segundos e inténtalo de nuevo.`;

/** Sin conexión se explica siempre igual; cualquier otro fallo, con el texto general que se le pase. */
export const mensajeDeFallo = (e: unknown, general: string) =>
  e instanceof NetworkError ? ERROR_RED : general;

// Casos que, sin un texto propio en la pantalla, se explican con el general y nunca con lo que manda el servidor
const CON_TEXTO_GENERAL = [
  'VALIDACION',
  'ERROR_HTTP',
  'RUTA_NO_ENCONTRADA',
  'IDEMPOTENCIA_CLAVE_REUTILIZADA',
  'CATEGORIA_PREDETERMINADA',
];

/**
 * Para un caso (4xx con `code`) del que la app no tiene texto: el `message` del backend y debajo su `action`.
 * Devuelve null cuando corresponde el texto de la app.
 */
export function mensajeDelServidor(e: unknown) {
  if (!(e instanceof ApiError) || !e.code || CON_TEXTO_GENERAL.includes(e.code)) return null;
  if (e.status < 400 || e.status >= 500 || e.status === 401) return null;
  return [e.message, e.action].filter(Boolean).join('\n');
}

/** Fallo al guardar o eliminar, cuando la pantalla ya descartó los casos que explica con su propio texto. */
export const mensajeAlCambiar = (e: unknown, general: string) =>
  mensajeDelServidor(e) ?? mensajeDeFallo(e, general);
