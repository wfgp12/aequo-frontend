import { ListaDeCategorias } from '@/components/categorias/lista-de-categorias';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Categoria, TipoMovimiento } from '@/lib/api/categorias';
import { View } from 'react-native';

type Props = {
  tipo: TipoMovimiento;
  onElegir: (categoria: Categoria) => void;
  onAtras: () => void;
};

/** Paso 2: "¿En qué categoría?". Muestra el selector de categorías y avanza al tocar una. */
export function PasoCategoria({ tipo, onElegir, onAtras }: Props) {
  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">¿En qué categoría?</Text>
      <View className="mt-3 flex-1">
        <ListaDeCategorias tipo={tipo} onElegir={onElegir} />
      </View>
      <Button variant="outline" className="h-[50px] w-full" onPress={onAtras}>
        <Text className="font-semibold">Atrás</Text>
      </Button>
    </View>
  );
}
