import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { TextInput, View } from 'react-native';

/** Deja solo dígitos y un separador decimal (coma o punto, se muestra siempre coma) con hasta 2 decimales. */
export function normalizarPorcentaje(texto: string) {
  const [entero, ...resto] = texto
    .replace(/\./g, ',')
    .replace(/[^\d,]/g, '')
    .split(',');
  return resto.length ? `${entero},${resto.join('').slice(0, 2)}` : entero;
}

type Props = {
  /** Porcentaje como texto, con coma decimal ("12,5"). */
  valor: string;
  onCambiar: (texto: string) => void;
  className?: string;
};

/** Campo de porcentaje de los ingresos: "12,5 % de tus ingresos". Solo guarda texto; el número lo arma quien lo envía. */
export function CampoPorcentaje({ valor, onCambiar, className }: Props) {
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <TextInput
        value={valor}
        onChangeText={(t) => onCambiar(normalizarPorcentaje(t))}
        placeholder="0"
        placeholderTextColor="#757B81"
        keyboardType="decimal-pad"
        accessibilityLabel="Porcentaje de tus ingresos"
        className="flex-1 text-foreground outline-none"
      />
      <Text variant="muted">% de tus ingresos</Text>
    </View>
  );
}
