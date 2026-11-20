import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { TipoMovimiento } from '@/lib/api/categorias';
import { opcionesDeMetodo, type OpcionDeMetodo } from '@/lib/metodos-de-pago';
import { Pressable, View } from 'react-native';

type Props = {
  tipo: TipoMovimiento;
  /** La tarjeta de crédito avanza como cualquier otra opción: el flujo pide después la tarjeta y las cuotas. */
  onElegir: (metodo: OpcionDeMetodo['valor']) => void;
  onAtras: () => void;
};

/** Paso 3: "¿Cómo pagaste?". La lista avanza al tocar una opción. */
export function PasoMetodoPago({ tipo, onElegir, onAtras }: Props) {
  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">
        {tipo === 'EGRESO' ? '¿Cómo pagaste?' : '¿Cómo lo recibiste?'}
      </Text>
      <View className="mt-3 flex-1 gap-2">
        {opcionesDeMetodo(tipo).map((o) => (
          <Pressable
            key={o.valor}
            accessibilityRole="button"
            accessibilityLabel={o.etiqueta}
            onPress={() => onElegir(o.valor)}
            className="h-12 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3"
          >
            <View className="size-5 rounded-full bg-muted" />
            <Text>{o.etiqueta}</Text>
          </Pressable>
        ))}
      </View>
      <Button variant="outline" className="h-[50px] w-full" onPress={onAtras}>
        <Text className="font-semibold">Atrás</Text>
      </Button>
    </View>
  );
}
