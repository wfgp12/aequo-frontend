import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Pressable, View } from 'react-native';

export const TOTAL_PASOS = 5;

type Props = { titulo: string; paso: number; onCerrar: () => void };

/** Encabezado del registro: ✕, título, "N de 5" y la barra de progreso de cinco tramos. */
export function EncabezadoRegistro({ titulo, paso, onCerrar }: Props) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onCerrar}
          hitSlop={12}
        >
          <Text className="text-xl">✕</Text>
        </Pressable>
        <Text className="font-semibold">{titulo}</Text>
        <Text variant="muted" className="text-xs">
          {paso} de {TOTAL_PASOS}
        </Text>
      </View>
      <View className="mt-3 flex-row gap-1" accessibilityLabel={`Paso ${paso} de ${TOTAL_PASOS}`}>
        {Array.from({ length: TOTAL_PASOS }, (_, i) => (
          <View
            key={i}
            className={cn('h-[3px] flex-1 rounded-full', i < paso ? 'bg-foreground' : 'bg-border')}
          />
        ))}
      </View>
    </View>
  );
}
