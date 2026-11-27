import { obtenerAhorroAcumulado } from '@/lib/api/ahorro';
import { mensajeDeFallo } from '@/lib/errores';
import { useRecursoRemoto } from '@/lib/use-recurso-remoto';
import { useCallback } from 'react';

function falloDelAcumulado(e: unknown) {
  return {
    mensaje: mensajeDeFallo(
      e,
      'No pudimos cargar tu ahorro anotado. Inténtalo de nuevo en unos minutos.',
    ),
    reintentar: true,
  };
}

/** El ahorro anotado hasta un mes. Al `recargar` se siguen viendo las cifras anteriores mientras llegan las nuevas. */
export function useAhorroAcumulado(mes: string) {
  const cargar = useCallback(() => obtenerAhorroAcumulado(mes), [mes]);
  return useRecursoRemoto(mes, cargar, falloDelAcumulado);
}
