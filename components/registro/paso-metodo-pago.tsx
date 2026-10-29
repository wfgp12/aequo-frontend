import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { TipoMovimiento } from '@/lib/api/categorias';
import type { MetodoPago } from '@/lib/api/transacciones';
import {
  AVISO_TARJETA_DE_CREDITO,
  opcionesDeMetodo,
  type OpcionDeMetodo,
} from '@/lib/metodos-de-pago';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

type Props = {
  tipo: TipoMovimiento;
  onElegir: (metodo: MetodoPago) => void;
  onAtras: () => void;
};

/** Paso 3: "¿Cómo pagaste?". La lista avanza al tocar una opción. */
export function PasoMetodoPago({ tipo, onElegir, onAtras }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  function elegir(opcion: OpcionDeMetodo) {
    if (opcion.valor === 'TARJETA_CREDITO') {
      setAviso(AVISO_TARJETA_DE_CREDITO);
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
        {opcionesDeMetodo(tipo).map((o) => (
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
