import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Pressable, View } from 'react-native';

type Props<T extends string> = {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onElegir: (valor: T) => void;
};

/** Opciones en una fila de botones redondeados; la elegida se anuncia como seleccionada. */
export function SelectorDePildoras<T extends string>({ opciones, valor, onElegir }: Props<T>) {
  return (
    <View className="flex-row gap-2">
      {opciones.map((opcion) => (
        <Pressable
          key={opcion.valor}
          accessibilityRole="button"
          accessibilityState={{ selected: valor === opcion.valor }}
          onPress={() => onElegir(opcion.valor)}
          className={cn(
            'h-10 flex-1 items-center justify-center rounded-full border border-border',
            valor === opcion.valor && 'border-foreground bg-foreground',
          )}
        >
          <Text className={cn('text-sm', valor === opcion.valor && 'text-background')}>
            {opcion.etiqueta}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
