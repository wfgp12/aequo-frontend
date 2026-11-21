import { esApi } from '@/lib/errores';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type EffectCallback } from 'react';

/** Cómo se le explica al usuario un fallo al cargar y si tiene sentido ofrecerle reintentar. */
export type Fallo = { mensaje: string; reintentar: boolean };

type Estado<T> = {
  /** A qué consulta pertenecen estos datos (por ejemplo, "tarjeta/mes"): una respuesta de otra no sirve. */
  clave: string;
  /** Intento de recarga al que respondió. */
  intento: number;
  dato: T | null;
  fallo: Fallo | null;
};

/** `useEffect` con la forma de `useFocusEffect`: recibe el efecto ya memorizado. */
function useEfecto(efecto: EffectCallback) {
  useEffect(efecto, [efecto]);
}

/** Pide el dato y entrega el resultado a `poner`; la función devuelta descarta una respuesta que llega tarde. */
function pedir<T>(
  cargar: () => Promise<T>,
  describirFallo: (e: unknown) => Fallo,
  poner: (resultado: Pick<Estado<T>, 'dato' | 'fallo'>) => void,
) {
  let activo = true;
  cargar()
    .then((dato) => activo && poner({ dato, fallo: null }))
    .catch((e: unknown) => {
      // Un 401 ya cerró la sesión y la app vuelve al login: sin aviso propio, se queda cargando
      if (activo && !esApi(e, 401)) poner({ dato: null, fallo: describirFallo(e) });
    });
  return () => {
    activo = false;
  };
}

/** Qué se ve del último resultado: solo el de esta consulta, y un fallo solo hasta que se vuelve a intentar. */
function vistaDe<T>(estado: Estado<T> | null, clave: string, intento: number) {
  const propio = estado?.clave === clave ? estado : null;
  const vigente = propio?.intento === intento;
  // Se está repitiendo la consulta que acababa de fallar
  const reintentando = propio !== null && propio.fallo !== null && !vigente;
  return {
    dato: propio?.dato ?? null,
    cargando: propio === null || reintentando,
    reintentando,
    fallo: vigente ? propio.fallo : null,
  };
}

/**
 * Un dato que se pide al backend al abrir la pantalla. `clave` identifica la consulta: si cambia, los datos de la
 * anterior se ocultan (y sus respuestas tardías se descartan). `recargar` repite la misma consulta: si ya había un
 * dato se sigue mostrando mientras llega el nuevo (sin parpadeo); si lo último fue un fallo, se vuelve a cargar.
 * Con `alEnfocar`, además se vuelve a pedir cada vez que la pantalla recupera el foco (al volver de otra).
 * `cargar` y `describirFallo` deben ser estables entre renders (funciones de módulo o `useCallback`).
 */
export function useRecursoRemoto<T>(
  clave: string,
  cargar: () => Promise<T>,
  describirFallo: (e: unknown) => Fallo,
  alEnfocar = false,
) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<Estado<T> | null>(null);
  const usarEfecto = alEnfocar ? useFocusEffect : useEfecto;

  usarEfecto(
    useCallback(
      () => pedir(cargar, describirFallo, (r) => setEstado({ clave, intento, ...r })),
      [clave, cargar, describirFallo, intento],
    ),
  );

  return { ...vistaDe(estado, clave, intento), recargar: () => setIntento((n) => n + 1) };
}
