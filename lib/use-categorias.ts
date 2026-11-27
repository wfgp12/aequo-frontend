import { listarCategorias, type TipoMovimiento } from '@/lib/api/categorias';
import { fallosDeCategorias } from '@/lib/categorias';
import { useRecursoRemoto } from '@/lib/use-recurso-remoto';
import { useCallback } from 'react';

/** Las categorías de un tipo, en el orden del backend; al cambiar de tipo no se ven las del anterior. */
export function useCategorias(tipo: TipoMovimiento) {
  const cargar = useCallback(() => listarCategorias(tipo), [tipo]);
  return useRecursoRemoto(tipo, cargar, fallosDeCategorias);
}
