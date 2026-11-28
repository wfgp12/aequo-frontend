import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { eliminarMeta } from '@/lib/api/ahorro';
import { esApi, esCaso, mensajeAlCambiar, yaNoExiste } from '@/lib/errores';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';

const mensajeAlQuitar = (e: unknown) =>
  esCaso(e, 409, 'META_CON_AHORRO')
    ? 'Ya anotaste ahorro en este mes, así que la meta no se puede quitar. Borra primero lo anotado.'
    : mensajeAlCambiar(e, 'No pudimos quitar tu meta. Inténtalo de nuevo en unos minutos.');

type Props = {
  metaId: string;
  /** "septiembre de 2026": el mes de la meta, como se lo nombra al usuario. */
  mes: string;
  onCancelar: () => void;
  /** La meta ya no existe (se quitó ahora o ya estaba quitada). */
  onQuitada: () => void;
};

/** Diálogo "¿Quitar tu meta de ahorro?": quitar la meta es permanente, así que siempre se confirma. */
export function DialogoQuitarMeta({ metaId, mes, onCancelar, onQuitada }: Props) {
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);

  async function quitar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setError(null);
    setQuitando(true);
    try {
      await eliminarMeta(metaId);
      onQuitada();
    } catch (e) {
      // Un 404 significa que ya estaba quitada: lo que el usuario quería ya se cumplió
      if (yaNoExiste(e)) onQuitada();
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      else if (!esApi(e, 401)) setError(mensajeAlQuitar(e));
    } finally {
      enVuelo.current = false;
      setQuitando(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[312px] rounded-2xl bg-card p-5"
          accessibilityLabel="¿Quitar tu meta de ahorro?"
        >
          <Text className="text-lg font-semibold">¿Quitar tu meta de ahorro?</Text>
          <Text variant="muted" className="mt-2">
            {`Se quitará la meta de ${mes}. Esta acción no se puede deshacer.`}
          </Text>

          <View className="mt-4 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onCancelar} disabled={quitando}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onPress={() => {
                void quitar();
              }}
              disabled={quitando}
            >
              {quitando ? <ActivityIndicator /> : <Text>Quitar</Text>}
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
