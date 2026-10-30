import { Text } from '@/components/ui/text';
import type { TransaccionListada } from '@/lib/api/transacciones';
import { montoConSigno, subtituloDelMovimiento, tituloDelMovimiento } from '@/lib/movimientos';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

/** Una fila de la lista: marca de categoría, título, "Categoría · Método" y el monto con su signo. */
export function FilaMovimiento({ item }: { item: TransaccionListada }) {
  return (
    <View className="mb-2 min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <View
        className={cn('size-9 rounded-full', item.tipo === 'INGRESO' ? 'bg-primary' : 'bg-muted')}
      />
      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {tituloDelMovimiento(item)}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {subtituloDelMovimiento(item)}
        </Text>
      </View>
      <Text className="font-semibold">{montoConSigno(item)}</Text>
    </View>
  );
}
