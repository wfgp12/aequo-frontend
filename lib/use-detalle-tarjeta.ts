import { listarPagos, obtenerProyeccion, obtenerTarjeta } from '@/lib/api/tarjetas';
import { mesActual } from '@/lib/fechas';
import { fallosDeDetalle } from '@/lib/tarjetas';
import { useRecursoRemoto } from '@/lib/use-recurso-remoto';
import { useCallback, useState } from 'react';

/**
 * Lo que necesita el detalle de una tarjeta: la tarjeta (una vez) y, del mes elegido, lo que paga y los pagos que ya
 * registró. El mes empieza en el de hoy y se vuelve a pedir al cambiar de mes y al volver a la pantalla (los cargos
 * fijos y los pagos pueden haber cambiado). `fallo` junta los de las tres consultas; `reintentar` repite solo la que
 * falló y `recargarMes` vuelve a pedir las cifras y los pagos (tras registrar o eliminar un pago).
 */
export function useDetalleTarjeta(id: string) {
  const [mes, setMes] = useState(() => mesActual());
  const cargarTarjeta = useCallback(() => obtenerTarjeta(id), [id]);
  const cargarProyeccion = useCallback(() => obtenerProyeccion(id, mes), [id, mes]);
  const cargarPagos = useCallback(() => listarPagos(id, mes), [id, mes]);
  const tarjeta = useRecursoRemoto(id, cargarTarjeta, fallosDeDetalle);
  const proyeccion = useRecursoRemoto(`${id}/${mes}`, cargarProyeccion, fallosDeDetalle, true);
  const pagos = useRecursoRemoto(`${id}/${mes}`, cargarPagos, fallosDeDetalle, true);

  const fallos = [tarjeta.fallo, proyeccion.fallo, pagos.fallo].filter((f) => f !== null);
  return {
    mes,
    cambiarMes: setMes,
    tarjeta: tarjeta.dato,
    proyeccion: proyeccion.dato,
    pagos: pagos.dato,
    // Si una dice que la tarjeta ya no existe, eso pesa más que el fallo de las otras
    fallo: fallos.find((f) => !f.reintentar) ?? fallos[0] ?? null,
    cargando: proyeccion.cargando || pagos.cargando || tarjeta.reintentando,
    reintentar: () => {
      if (tarjeta.fallo) tarjeta.recargar();
      if (proyeccion.fallo) proyeccion.recargar();
      if (pagos.fallo) pagos.recargar();
    },
    recargarTarjeta: tarjeta.recargar,
    recargarMes: () => {
      proyeccion.recargar();
      pagos.recargar();
    },
  };
}
