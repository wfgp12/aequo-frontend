import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { esApi } from '@/lib/errores';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';

type Props = {
  /** "¿Eliminar esta tarjeta?" */
  titulo: string;
  detalle: string;
  eliminar: () => Promise<void>;
  /** Mensaje para un fallo del backend o de la red (el 401 y el 404 no llegan aquí). */
  mensajeDeError: (e: unknown) => string;
  onCancelar: () => void;
  /** Ya no existe (se eliminó ahora o ya estaba eliminado). */
  onEliminado: () => void;
};

/** Diálogo de confirmación de eliminar: el borrado es permanente, así que siempre se confirma. */
export function DialogoEliminar({
  titulo,
  detalle,
  eliminar,
  mensajeDeError,
  onCancelar,
  onEliminado,
}: Props) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);

  async function confirmar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setError(null);
    setEliminando(true);
    try {
      await eliminar();
      onEliminado();
    } catch (e) {
      // Un 404 significa que ya estaba eliminado: lo que el usuario quería ya se cumplió
      if (esApi(e, 404)) onEliminado();
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      else if (!esApi(e, 401)) setError(mensajeDeError(e));
    } finally {
      enVuelo.current = false;
      setEliminando(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[312px] rounded-2xl bg-card p-5"
          accessibilityLabel={titulo}
        >
          <Text className="text-lg font-semibold">{titulo}</Text>
          <Text variant="muted" className="mt-2">
            {detalle}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onCancelar} disabled={eliminando}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onPress={() => {
                void confirmar();
              }}
              disabled={eliminando}
            >
              {eliminando ? <ActivityIndicator /> : <Text>Eliminar</Text>}
            </Button>
          </View>

          {error ? (
            <Text variant="muted" role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
