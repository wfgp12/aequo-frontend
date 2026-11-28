import { claveGastada, esApi } from '@/lib/errores';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';

/**
 * Guardado de un registro del flujo paso a paso (movimiento, compra con tarjeta o avance): protege el doble toque y
 * conserva la clave de idempotencia mientras lo que se envía no cambie, así un reintento no crea un segundo registro.
 * `huella` es todo lo que identifica lo enviado: si cambia, es una acción nueva y lleva otra clave.
 */
export function useGuardarRegistro<R>() {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<R | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);
  const intento = useRef<{ huella: string; clave: string } | null>(null);

  async function guardar(
    huella: unknown,
    enviar: (clave: string) => Promise<R>,
    mensajeDeError: (e: unknown) => string,
  ) {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setError(null);
    setGuardando(true);
    try {
      const texto = JSON.stringify(huella);
      if (intento.current?.huella !== texto)
        intento.current = { huella: texto, clave: randomUUID() };
      setGuardado(await enviar(intento.current.clave));
    } catch (e) {
      if (claveGastada(e)) intento.current = null;
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      if (!esApi(e, 401)) setError(mensajeDeError(e));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  /** Para avisar algo antes de enviar (un dato que falta) o quitar el aviso al cambiar lo escrito (`null`). */
  return { guardando, error, guardado, guardar, avisar: setError };
}
