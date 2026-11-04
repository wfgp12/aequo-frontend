import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api/client';
import { eliminarTransaccion, type TransaccionListada } from '@/lib/api/transacciones';
import { formatearPesos } from '@/lib/dinero';
import { diaYMesCorto } from '@/lib/fechas';
import { mensajeAlEliminar, tituloDelMovimiento } from '@/lib/movimientos';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';

type Props = {
  item: TransaccionListada;
  onCancelar: () => void;
  /** El movimiento ya no existe (se eliminó ahora o ya estaba eliminado). */
  onEliminado: () => void;
};

/** Diálogo "¿Eliminar este movimiento?" del wireframe de Figma: el borrado es permanente, así que siempre se confirma. */
export function DialogoEliminarMovimiento({ item, onCancelar, onEliminado }: Props) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);

  async function eliminar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setError(null);
    setEliminando(true);
    try {
      await eliminarTransaccion(item.id);
      onEliminado();
    } catch (e) {
      // Un 404 significa que ya estaba eliminado: el resultado que el usuario quería ya se cumplió
      if (e instanceof ApiError && e.status === 404) onEliminado();
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      else setError(mensajeAlEliminar(e));
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
          accessibilityLabel="¿Eliminar este movimiento?"
        >
          <Text className="text-lg font-semibold">¿Eliminar este movimiento?</Text>
          <Text variant="muted" className="mt-2">
            {`${tituloDelMovimiento(item)} · $ ${formatearPesos(item.monto)} · ${diaYMesCorto(item.fecha)} Esta acción no se puede deshacer.`}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onCancelar} disabled={eliminando}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onPress={() => {
                void eliminar();
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
