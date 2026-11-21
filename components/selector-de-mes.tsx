import { Text } from '@/components/ui/text';
import { mesEnLetras, restarMeses } from '@/lib/fechas';
import { Pressable, View } from 'react-native';

/** "‹ noviembre 2026 ›": cambia el mes (YYYY-MM) de uno en uno, sin tope hacia ningún lado. */
export function SelectorDeMes({
  mes,
  onCambiar,
}: {
  mes: string;
  onCambiar: (mes: string) => void;
}) {
  return (
    <View className="mt-2 flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        onPress={() => onCambiar(restarMeses(mes, 1))}
        hitSlop={12}
        className="min-h-11 min-w-11 items-center justify-center"
      >
        <Text className="text-2xl">‹</Text>
      </Pressable>
      <Text className="text-lg font-semibold">{mesEnLetras(mes)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        onPress={() => onCambiar(restarMeses(mes, -1))}
        hitSlop={12}
        className="min-h-11 min-w-11 items-center justify-center"
      >
        <Text className="text-2xl">›</Text>
      </Pressable>
    </View>
  );
}
