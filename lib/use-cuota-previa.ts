import { obtenerCuotaPrevia, type CuotaPrevia } from '@/lib/api/tarjetas';
import { esApi } from '@/lib/errores';
import { fallosDeCuotaPrevia } from '@/lib/tarjetas';
import type { Fallo } from '@/lib/use-lista-remota';
import { useEffect, useRef, useState } from 'react';

/** Lo que se espera sin que el usuario cambie nada antes de preguntarle la cuota al backend. */
const ESPERA_MS = 400;

type Respuesta = { clave: string; cuota: CuotaPrevia } | { clave: string; fallo: Fallo };

/** Estado de la cuota estimada para lo que hay elegido en pantalla. */
export type VistaPrevia =
  | { estado: 'sin-consulta' }
  | { estado: 'calculando' }
  | { estado: 'lista'; cuota: CuotaPrevia }
  | { estado: 'fallo'; fallo: Fallo };

/**
 * Cuota estimada que calcula el backend (el frontend no calcula nada, RNF-11). Se pide al llegar y, cuando cambia
 * algo, tras 400 ms sin más cambios; `reintentar` la pide de nuevo enseguida. Una respuesta solo vale para los datos
 * con que se pidió: si cambian, se deja de mostrar de inmediato y una respuesta atrasada se descarta.
 * Con `cuotas` null (todavía no es un número válido) no se pide nada.
 */
export function useCuotaPrevia(
  tarjetaId: string,
  valor: number,
  cuotas: number | null,
  primerPago: string,
) {
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const ultimoIntento = useRef<number | null>(null);
  const clave = cuotas === null ? null : `${tarjetaId}|${valor}|${cuotas}|${primerPago}|${intento}`;

  useEffect(() => {
    if (clave === null || cuotas === null) return;
    // La primera consulta y cada reintento salen enseguida; los cambios esperan a que el usuario termine de tocar
    const enseguida = ultimoIntento.current !== intento;
    ultimoIntento.current = intento;
    let vigente = true;
    const pedir = () =>
      obtenerCuotaPrevia(tarjetaId, { valor, cuotas, primerPago }).then(
        (cuota) => {
          if (vigente) setRespuesta({ clave, cuota });
        },
        (e: unknown) => {
          // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio
          if (vigente && !esApi(e, 401)) setRespuesta({ clave, fallo: fallosDeCuotaPrevia(e) });
        },
      );
    if (enseguida) {
      void pedir();
      return () => {
        vigente = false;
      };
    }
    const espera = setTimeout(() => void pedir(), ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [clave, cuotas, intento, tarjetaId, valor, primerPago]);

  let vista: VistaPrevia = { estado: 'calculando' };
  if (clave === null) vista = { estado: 'sin-consulta' };
  else if (respuesta?.clave === clave) {
    vista =
      'cuota' in respuesta
        ? { estado: 'lista', cuota: respuesta.cuota }
        : { estado: 'fallo', fallo: respuesta.fallo };
  }
  return { vista, reintentar: () => setIntento((n) => n + 1) };
}
