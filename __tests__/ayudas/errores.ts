import { ApiError } from '@/lib/api/client';

// Ayudas de las pruebas de los códigos de error (criterios/08-codigos-de-error.md). No son pruebas: Jest solo corre
// los archivos *.test.ts(x).

/**
 * El error que entrega el adaptador cuando el backend responde con `code` (y a veces `action`). Los campos se
 * asignan por fuera para no fijar la firma del constructor de `ApiError`.
 */
export const conCodigo = (
  status: number,
  code: string,
  message = 'mensaje del servidor',
  action?: string,
) => Object.assign(new ApiError(status, message), { code, action });

// Un caso para el que ninguna pantalla de la app tiene texto propio (CA-RNF04-18)
const MENSAJE = 'Esa deuda tiene abonos y no se puede quitar.';
const ACCION = 'Elimina primero los abonos de esa deuda.';
export const desconocido = (status = 409) => conCodigo(status, 'DEUDA_CON_ABONOS', MENSAJE, ACCION);
export const desconocidoSinAccion = (status = 409) => conCodigo(status, 'ALGO_NUEVO', MENSAJE);
/** El aviso único: el `message` y debajo el `action`, sin nada más. */
export const MENSAJE_Y_ACCION =
  /^Esa deuda tiene abonos y no se puede quitar\.\s*Elimina primero los abonos de esa deuda\.$/;
export const SOLO_MENSAJE = MENSAJE;

/** Un 4xx sin catalogar, con el `message` en inglés. */
export const errorHttp = () =>
  conCodigo(429, 'ERROR_HTTP', 'ThrottlerException: Too Many Requests');

/** Fallos que se explican con el texto general de la pantalla, nunca con lo que manda el servidor (CA-16 y CA-17). */
export const CON_TEXTO_GENERAL: [string, string, ApiError][] = [
  [
    'CA-RNF04-16',
    'VALIDACION',
    conCodigo(
      400,
      'VALIDACION',
      'monto must be a positive number, property foo should not exist',
      'Revisa los datos marcados',
    ),
  ],
  ['CA-RNF04-17', 'ERROR_HTTP', errorHttp()],
  [
    'CA-RNF04-17',
    'ERROR_INTERNO',
    conCodigo(500, 'ERROR_INTERNO', 'Internal server error', 'Inténtalo de nuevo en unos minutos'),
  ],
];

/** Una dirección que no existe: es un 404, pero no significa que algo se haya eliminado (CA-RNF04-15). */
export const rutaNoEncontrada = () =>
  conCodigo(404, 'RUTA_NO_ENCONTRADA', 'Cannot DELETE /ruta-que-no-existe');

/** Lo que el usuario nunca debe leer (CA-RNF04-19). */
export const CODIGOS_Y_TECNICISMOS =
  /[A-Z]{2,}_[A-Z_]+|(?<![\d.,])(?:400|401|403|404|409|422|429|500|502|503)(?![\d.,])|[Ii]dempoten|payload|\bnull\b|undefined|ApiError|NetworkError/;
