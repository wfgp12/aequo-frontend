import { CampoMonto } from '@/components/campo-monto';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

type Props = {
  tipo: 'INGRESO' | 'EGRESO';
  /** Monto en pesos, solo dígitos. */
  valor: string;
  onCambiar: (digitos: string) => void;
  onSiguiente: () => void;
};

/** Paso 1: "¿Cuánto gastaste?" con el monto grande y el teclado numérico del sistema. */
export function PasoValor({ tipo, valor, onCambiar, onSiguiente }: Props) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-semibold">
          {tipo === 'EGRESO' ? '¿Cuánto gastaste?' : '¿Cuánto recibiste?'}
        </Text>
        <CampoMonto
          valor={valor}
          onCambiar={onCambiar}
          autoFocus
          className="mt-4 w-full text-center text-4xl font-bold"
        />
        <Text variant="muted" className="mt-2 text-xs">
          Pesos colombianos (COP)
        </Text>
      </View>
      <Button className="h-[50px] w-full" disabled={Number(valor) <= 0} onPress={onSiguiente}>
        <Text className="font-semibold">Siguiente</Text>
      </Button>
    </View>
  );
}
