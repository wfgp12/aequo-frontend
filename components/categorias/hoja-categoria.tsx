import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { TipoMovimiento } from '@/lib/api/categorias';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, TextInput, View } from 'react-native';

type Props = {
  titulo: string;
  /** Se muestra, pero no se puede cambiar. */
  tipo: TipoMovimiento;
  nombre: string;
  onCambiarNombre: (nombre: string) => void;
  aviso: string | null;
  guardando: boolean;
  onGuardar: () => void;
  onCerrar: () => void;
  /** Botones que van después de "Guardar" (solo al editar). */
  children?: ReactNode;
};

/** La hoja de una categoría (nueva o existente): ✕, tipo fijo, nombre, aviso y "Guardar". */
export function HojaCategoria({
  titulo,
  tipo,
  nombre,
  onCambiarNombre,
  aviso,
  guardando,
  onGuardar,
  onCerrar,
  children,
}: Props) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[420px] self-center rounded-t-3xl bg-background px-5 pb-6 pt-4"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onCerrar}
              hitSlop={12}
            >
              <Text className="text-xl">✕</Text>
            </Pressable>
            <Text className="text-lg font-semibold">{titulo}</Text>
            <View className="w-5" />
          </View>

          <Text variant="muted" className="mb-1 mt-4 text-xs font-semibold">
            Tipo
          </Text>
          <Text className="h-12 rounded-lg bg-muted px-3 py-3">
            {tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
          </Text>

          <Text variant="muted" className="mb-1 mt-4 text-xs font-semibold">
            Nombre
          </Text>
          <TextInput
            value={nombre}
            onChangeText={onCambiarNombre}
            placeholder="Ej. Mascotas"
            placeholderTextColor="#757B81"
            accessibilityLabel="Nombre"
            className="h-12 rounded-lg border border-border bg-card px-3 text-foreground"
          />

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
            {guardando ? <ActivityIndicator /> : <Text className="font-semibold">Guardar</Text>}
          </Button>
          {children}
        </View>
      </View>
    </Modal>
  );
}
