import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatearPesos, soloDigitos } from '@/lib/dinero';
import { TextInput, View } from 'react-native';

// Tope del backend: 999.999.999.999 pesos (12 dígitos)
const MAX_DIGITOS = 12;

type Props = {
  tipo: 'INGRESO' | 'EGRESO';
  /** Monto en pesos, solo dígitos. */
  valor: string;
  onCambiar: (digitos: string) => void;
  onSiguiente: () => void;
};

/** Paso 1: "¿Cuánto gastaste?" con el monto grande y el teclado numérico del sistema. */
export function PasoValor({ tipo, valor, onCambiar, onSiguiente }: Props) {
  const monto = Number(valor);

  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-semibold">
          {tipo === 'EGRESO' ? '¿Cuánto gastaste?' : '¿Cuánto recibiste?'}
        </Text>
        <TextInput
          value={monto > 0 ? `$ ${formatearPesos(monto)}` : ''}
          onChangeText={(t) => onCambiar(soloDigitos(t).replace(/^0+/, '').slice(0, MAX_DIGITOS))}
          placeholder="$ 0"
          placeholderTextColor="#757B81"
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus
          accessibilityLabel="Monto en pesos"
          className="mt-4 w-full text-center text-4xl font-bold text-foreground outline-none"
        />
        <Text variant="muted" className="mt-2 text-xs">
          Pesos colombianos (COP)
        </Text>
      </View>
      <Button className="h-[50px] w-full" disabled={monto <= 0} onPress={onSiguiente}>
        <Text className="font-semibold">Siguiente</Text>
      </Button>
    </View>
  );
}
