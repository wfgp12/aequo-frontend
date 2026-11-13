import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Fallo } from '@/lib/use-lista-remota';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

type Props = {
  titulo: string;
  /** Línea pequeña bajo el título. */
  subtitulo?: string;
  /** Lo que anuncia el lector de pantalla mientras carga: "Cargando tus tarjetas". */
  etiquetaDeCarga: string;
  cargando: boolean;
  fallo: Fallo | null;
  onReintentar: () => void;
  /** Hoja o diálogo que se abre sobre la pantalla. */
  hoja?: ReactNode;
  /** La lista, que solo se ve cuando ya cargó. */
  children: ReactNode;
};

/** Pantalla de una lista del backend: encabezado con "Volver", indicador de carga, aviso de fallo y la lista. */
export function PantallaDeLista({
  titulo,
  subtitulo,
  etiquetaDeCarga,
  cargando,
  fallo,
  onReintentar,
  hoja,
  children,
}: Props) {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background px-5 pt-12">
      <ScrollView
        className="w-full max-w-[420px] flex-1 self-center"
        contentContainerClassName="gap-3 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-1 flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text className="text-2xl">‹</Text>
          </Pressable>
          <View>
            <Text className="text-xl font-bold">{titulo}</Text>
            {subtitulo ? <Text variant="muted">{subtitulo}</Text> : null}
          </View>
        </View>

        {cargando ? (
          <View className="items-center py-10">
            <ActivityIndicator accessibilityLabel={etiquetaDeCarga} />
          </View>
        ) : fallo ? (
          <View className="items-center gap-3 py-6">
            <Text variant="muted" role="alert" className="text-center">
              {fallo.mensaje}
            </Text>
            {fallo.reintentar ? (
              <Button variant="outline" onPress={onReintentar}>
                <Text>Reintentar</Text>
              </Button>
            ) : null}
          </View>
        ) : (
          children
        )}
      </ScrollView>
      {hoja}
    </View>
  );
}

/** Fila tocable de la lista: título y detalle; el lector de pantalla los lee juntos ("Netflix, $ 45.000 al mes"). */
export function FilaDeLista({
  titulo,
  detalle,
  onPress,
}: {
  titulo: string;
  detalle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}, ${detalle}`}
      onPress={onPress}
      className="min-h-14 justify-center rounded-xl border border-border bg-card px-4 py-2"
    >
      <Text className="font-semibold">{titulo}</Text>
      <Text variant="muted">{detalle}</Text>
    </Pressable>
  );
}

/** Botón punteado del final de la lista: "+ Agregar tarjeta". */
export function BotonAgregar({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={onPress}
      className="min-h-14 items-center justify-center rounded-xl border border-dashed border-border"
    >
      <Text variant="muted" className="font-semibold">
        {texto}
      </Text>
    </Pressable>
  );
}
