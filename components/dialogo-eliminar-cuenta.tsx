import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useState } from 'react';
import { ActivityIndicator, Modal, TextInput, View } from 'react-native';

export const PALABRA_DE_CONFIRMACION = 'ELIMINAR';

type Props = {
  eliminando: boolean;
  error: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
};

// Diálogo "¿Eliminar tu cuenta?" del wireframe de Figma. La eliminación es permanente, así que el botón
// solo se habilita al escribir la palabra exacta. Se monta solo cuando está abierto, y así el campo empieza vacío.
export function DialogoEliminarCuenta({ eliminando, error, onCancelar, onConfirmar }: Props) {
  const [texto, setTexto] = useState('');
  const habilitado = texto === PALABRA_DE_CONFIRMACION && !eliminando;

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancelar}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[312px] rounded-2xl bg-card p-5"
          accessibilityLabel="¿Eliminar tu cuenta?"
        >
          <Text className="text-lg font-semibold">¿Eliminar tu cuenta?</Text>
          <Text variant="muted" className="mt-2">
            Se borrarán para siempre tus movimientos, tarjetas, préstamos, presupuesto, categorías
            personalizadas y tu meta de ahorro. Esta acción no se puede deshacer.
          </Text>

          <Text className="mt-4 text-xs font-semibold">Escribe ELIMINAR para confirmar</Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={PALABRA_DE_CONFIRMACION}
            placeholderTextColor="#757B81"
            accessibilityLabel="Escribe ELIMINAR para confirmar"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!eliminando}
            className="mt-2 h-11 rounded-lg border border-input bg-background px-3 text-foreground"
          />

          <View className="mt-4 flex-row gap-3">
            <Button variant="outline" className="flex-1" onPress={onCancelar} disabled={eliminando}>
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onPress={onConfirmar}
              disabled={!habilitado}
            >
              {eliminando ? <ActivityIndicator /> : <Text>Eliminar cuenta</Text>}
            </Button>
          </View>

          <Text variant="muted" className="mt-3 text-xs">
            El botón se habilita al escribir la palabra exacta.
          </Text>
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
