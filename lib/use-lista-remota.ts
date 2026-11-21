import { useRecursoRemoto, type Fallo } from '@/lib/use-recurso-remoto';

export type { Fallo };

/**
 * Lista que se pide al backend al abrir la pantalla (y, con `alEnfocar`, cada vez que recupera el foco). `recargar`
 * la vuelve a pedir: si ya había una lista se sigue mostrando mientras llega la nueva (sin parpadeo); si lo último
 * fue un fallo, se vuelve al indicador de carga. `cargar` y `describirFallo` deben ser estables entre renders.
 */
export function useListaRemota<T>(
  cargar: () => Promise<T[]>,
  describirFallo: (e: unknown) => Fallo,
  alEnfocar = false,
) {
  const { dato, cargando, fallo, recargar } = useRecursoRemoto(
    '',
    cargar,
    describirFallo,
    alEnfocar,
  );
  return { cargando, items: dato ?? [], fallo, recargar };
}
