import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { TipoMovimiento } from '@/lib/api/categorias';
import type { MetodoPago } from '@/lib/api/transacciones';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

type Opcion = { etiqueta: string; valor: MetodoPago | 'TARJETA_CREDITO' };

const OPCIONES: Opcion[] = [
  { etiqueta: 'Efectivo', valor: 'EFECTIVO' },
  { etiqueta: 'Tarjeta débito', valor: 'DEBITO' },
  { etiqueta: 'Tarjeta crédito', valor: 'TARJETA_CREDITO' },
  { etiqueta: 'Transferencia', valor: 'TRANSFERENCIA' },
];

type Props = {
  tipo: TipoMovimiento;
  onElegir: (metodo: MetodoPago) => void;
  onAtras: () => void;
};

/** Paso 3: "¿Cómo pagaste?". La lista avanza al tocar una opción. */
export function PasoMetodoPago({ tipo, onElegir, onAtras }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  // La tarjeta de crédito solo aplica a los egresos
  const opciones =
    tipo === 'EGRESO' ? OPCIONES : OPCIONES.filter((o) => o.valor !== 'TARJETA_CREDITO');

  function elegir(opcion: Opcion) {
    if (opcion.valor === 'TARJETA_CREDITO') {
      // Las compras con tarjeta se registran en el módulo de tarjetas, que todavía no existe
      setAviso(
        'Las compras con tarjeta de crédito se podrán registrar muy pronto. Por ahora elige otro método.',
      );
      return;
    }
    setAviso(null);
    onElegir(opcion.valor);
  }

  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">
        {tipo === 'EGRESO' ? '¿Cómo pagaste?' : '¿Cómo lo recibiste?'}
      </Text>
      <View className="mt-3 flex-1 gap-2">
        {opciones.map((o) => (
          <Pressable
            key={o.valor}
            accessibilityRole="button"
            accessibilityLabel={o.etiqueta}
            onPress={() => elegir(o)}
            className="h-12 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3"
          >
            <View className="size-5 rounded-full bg-muted" />
            <Text>{o.etiqueta}</Text>
          </Pressable>
        ))}
        {aviso ? (
          <Text variant="muted" role="alert" className="mt-2 text-xs">
            {aviso}
          </Text>
        ) : null}
      </View>
      <Button variant="outline" className="h-[50px] w-full" onPress={onAtras}>
        <Text className="font-semibold">Atrás</Text>
      </Button>
    </View>
  );
}
