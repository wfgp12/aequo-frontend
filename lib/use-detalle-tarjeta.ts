import { obtenerProyeccion, obtenerTarjeta } from '@/lib/api/tarjetas';
import { mesActual } from '@/lib/fechas';
import { fallosDeDetalle } from '@/lib/tarjetas';
import { useRecursoRemoto } from '@/lib/use-recurso-remoto';
import { useCallback, useState } from 'react';

/**
 * Lo que necesita el detalle de una tarjeta: la tarjeta (una vez) y lo que paga en el mes elegido, que empieza en el
 * de hoy y se vuelve a pedir al cambiar de mes y al volver a la pantalla (los cargos fijos pueden haber cambiado).
 * `fallo` junta los de las dos consultas; `reintentar` repite solo la que falló.
 */
export function useDetalleTarjeta(id: string) {
  const [mes, setMes] = useState(() => mesActual());
  const cargarTarjeta = useCallback(() => obtenerTarjeta(id), [id]);
  const cargarProyeccion = useCallback(() => obtenerProyeccion(id, mes), [id, mes]);
  const tarjeta = useRecursoRemoto(id, cargarTarjeta, fallosDeDetalle);
  const proyeccion = useRecursoRemoto(`${id}/${mes}`, cargarProyeccion, fallosDeDetalle, true);

  const fallos = [tarjeta.fallo, proyeccion.fallo].filter((f) => f !== null);
  return {
    mes,
    cambiarMes: setMes,
    tarjeta: tarjeta.dato,
    proyeccion: proyeccion.dato,
    // Si una dice que la tarjeta ya no existe, eso pesa más que el fallo de la otra
    fallo: fallos.find((f) => !f.reintentar) ?? fallos[0] ?? null,
    cargando: proyeccion.cargando || tarjeta.reintentando,
    reintentar: () => {
      if (tarjeta.fallo) tarjeta.recargar();
      if (proyeccion.fallo) proyeccion.recargar();
    },
    recargarTarjeta: tarjeta.recargar,
  };
}
