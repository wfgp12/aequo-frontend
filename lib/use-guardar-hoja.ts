import { esApi } from '@/lib/errores';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';

/** Lo que se lee del formulario: los datos completos o el aviso de por qué todavía no se pueden guardar. */
export type Lectura<D> = { datos: D } | { error: string };

type Opciones<D> = {
  leer: () => Lectura<D>;
  /** Solo al editar: lo que cambió respecto a lo guardado y cómo enviarlo. En un formulario nuevo, null. */
  edicion: {
    cambios: (datos: D) => Partial<D>;
    enviar: (cambios: Partial<D>) => Promise<unknown>;
  } | null;
  /** Solo al crear: la clave identifica la acción del usuario y se reutiliza al reintentar. */
  crear: (datos: D, clave: string) => Promise<unknown>;
  /** Mensaje para un fallo del backend o de la red (el 401 no llega aquí: ya cerró la sesión). */
  mensajeDeError: (e: unknown, editando: boolean) => string;
  /** Algo cambió en el servidor (se guardó o se descubrió que ya no existe): la lista debe volver a cargarse. */
  onCambio: () => void;
  onCerrar: () => void;
};

/**
 * Guardado de una hoja de formulario (crear o editar): valida antes de llamar, envía solo lo que cambió al editar,
 * protege el doble toque y conserva la clave de idempotencia mientras lo escrito no cambie.
 */
export function useGuardarHoja<D extends object>({
  leer,
  edicion,
  crear,
  mensajeDeError,
  onCambio,
  onCerrar,
}: Opciones<D>) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón
  const enVuelo = useRef(false);
  // Clave de la creación en curso: se reutiliza al reintentar y se renueva si cambia lo escrito
  const intento = useRef<{ huella: string; clave: string } | null>(null);

  async function enviar(envio: () => Promise<unknown>) {
    enVuelo.current = true;
    setAviso(null);
    setGuardando(true);
    try {
      await envio();
      onCambio();
      onCerrar();
    } catch (e) {
      // Si ya no existe, la lista debe dejar de mostrarlo aunque la hoja siga abierta con el aviso
      if (esApi(e, 404)) onCambio();
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      if (!esApi(e, 401)) setAviso(mensajeDeError(e, edicion !== null));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  async function guardar() {
    if (enVuelo.current) return;
    const lectura = leer();
    if ('error' in lectura) return setAviso(lectura.error);
    const { datos } = lectura;
    if (edicion) {
      const cambios = edicion.cambios(datos);
      if (Object.keys(cambios).length === 0) return onCerrar();
      return enviar(() => edicion.enviar(cambios));
    }
    const huella = JSON.stringify(datos);
    if (intento.current?.huella !== huella) intento.current = { huella, clave: randomUUID() };
    const { clave } = intento.current;
    return enviar(() => crear(datos, clave));
  }

  return { aviso, guardando, limpiarAviso: () => setAviso(null), guardar };
}
