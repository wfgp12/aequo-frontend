import { SelectorDeFecha } from '@/components/selector-de-fecha';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

type Props = {
  /** Fecha elegida, en formato YYYY-MM-DD. */
  fecha: string;
  onCambiar: (iso: string) => void;
  onSiguiente: () => void;
  onAtras: () => void;
};

/** Paso 4: "¿Cuándo fue?". Hoy por defecto, ayer, u otra fecha con calendario. */
export function PasoFecha({ fecha, onCambiar, onSiguiente, onAtras }: Props) {
  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">¿Cuándo fue?</Text>
      <View className="mt-3 flex-1">
        <SelectorDeFecha fecha={fecha} onCambiar={onCambiar} />
      </View>

      <View className="flex-row gap-3">
        <Button variant="outline" className="h-[50px] flex-1" onPress={onAtras}>
          <Text className="font-semibold">Atrás</Text>
        </Button>
        <Button className="h-[50px] flex-1" onPress={onSiguiente}>
          <Text className="font-semibold">Siguiente</Text>
        </Button>
      </View>
    </View>
  );
}
