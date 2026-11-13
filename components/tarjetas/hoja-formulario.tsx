import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

type Props = {
  titulo: string;
  onCerrar: () => void;
  /** Aviso de validación o de error al guardar. */
  aviso: string | null;
  guardando: boolean;
  textoGuardar: string;
  onGuardar: () => void;
  /** Los campos del formulario. */
  children: ReactNode;
  /** Botones y notas que van después de "Guardar" (solo al editar). */
  acciones?: ReactNode;
};

/** Hoja de formulario sobre la lista: "Volver", los campos, el aviso y el botón de guardar con su indicador. */
export function HojaFormulario({
  titulo,
  onCerrar,
  aviso,
  guardando,
  textoGuardar,
  onGuardar,
  children,
  acciones,
}: Props) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          accessibilityViewIsModal
          className="max-h-[720px] w-full max-w-[420px] self-center rounded-t-3xl bg-background px-5 pb-6 pt-4"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={onCerrar}
              hitSlop={12}
            >
              <Text className="text-2xl">‹</Text>
            </Pressable>
            <Text className="text-lg font-semibold">{titulo}</Text>
            <View className="w-5" />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {children}

            {aviso ? (
              <Text
                variant="muted"
                role="alert"
                className="mt-4 text-center text-xs text-destructive"
              >
                {aviso}
              </Text>
            ) : null}

            <Button className="mt-4 h-[50px] w-full" disabled={guardando} onPress={onGuardar}>
              {guardando ? (
                <ActivityIndicator />
              ) : (
                <Text className="font-semibold">{textoGuardar}</Text>
              )}
            </Button>
            {acciones}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Un campo con su etiqueta encima. */
export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View className="mt-4">
      <Text variant="muted" className="mb-1 text-xs font-semibold">
        {etiqueta}
      </Text>
      {children}
    </View>
  );
}

export const ESTILO_CAMPO = 'h-12 rounded-lg border border-border bg-card px-3';

/** Campo de texto: el lector de pantalla lo anuncia con el nombre de su etiqueta. */
export function CampoTexto({
  etiqueta,
  valor,
  onCambiar,
  ...props
}: { etiqueta: string; valor: string; onCambiar: (texto: string) => void } & Pick<
  TextInputProps,
  'placeholder' | 'keyboardType'
>) {
  return (
    <Campo etiqueta={etiqueta}>
      <TextInput
        {...props}
        value={valor}
        onChangeText={onCambiar}
        placeholderTextColor="#757B81"
        accessibilityLabel={etiqueta}
        className={cn(ESTILO_CAMPO, 'text-foreground')}
      />
    </Campo>
  );
}

/** Fila con un interruptor: se anuncia como interruptor con el nombre de la etiqueta y su estado. */
export function CampoInterruptor({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  valor: boolean;
  onCambiar: (valor: boolean) => void;
}) {
  return (
    <View className="mt-4 min-h-14 flex-row items-center justify-between gap-3">
      <Text className="flex-1">{etiqueta}</Text>
      <Switch
        accessibilityLabel={etiqueta}
        value={valor}
        onValueChange={onCambiar}
        trackColor={{ true: '#FFD300' }}
      />
    </View>
  );
}
