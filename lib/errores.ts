import { ApiError, NetworkError } from '@/lib/api/client';

export const ERROR_RED =
  'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** El backend respondió con ese código de estado. */
export const esApi = (e: unknown, status: number) => e instanceof ApiError && e.status === status;

/** Sin conexión se explica siempre igual; cualquier otro fallo, con el texto general que se le pase. */
export const mensajeDeFallo = (e: unknown, general: string) =>
  e instanceof NetworkError ? ERROR_RED : general;
