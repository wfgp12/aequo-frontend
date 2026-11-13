import { listarCargos, listarTarjetas } from '@/lib/api/tarjetas';
import { fallosDeCargos, fallosDeTarjetas } from '@/lib/tarjetas';
import { useListaRemota } from '@/lib/use-lista-remota';
import { useCallback } from 'react';

/** Las tarjetas del usuario, ya ordenadas por el backend. */
export const useTarjetas = () => useListaRemota(listarTarjetas, fallosDeTarjetas);

/** Todos los cargos fijos de una tarjeta (activos e inactivos), en el orden en que llegan. */
export function useCargos(tarjetaId: string) {
  const cargar = useCallback(() => listarCargos(tarjetaId), [tarjetaId]);
  return useListaRemota(cargar, fallosDeCargos);
}
