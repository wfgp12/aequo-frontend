import { formatearPesos, soloDigitos } from '@/lib/dinero';
import { cn } from '@/lib/utils';
import { TextInput } from 'react-native';

// Tope del backend: 999.999.999.999 pesos (12 dígitos)
const MAX_DIGITOS = 12;

type Props = {
  /** Monto en pesos, solo dígitos. */
  valor: string;
  onCambiar: (digitos: string) => void;
  className?: string;
  autoFocus?: boolean;
  editable?: boolean;
};

/** Campo de monto en pesos: muestra "$ 45.000" y guarda solo los dígitos (sin ceros a la izquierda, con tope). */
export function CampoMonto({ valor, onCambiar, className, autoFocus, editable = true }: Props) {
  const monto = Number(valor);

  return (
    <TextInput
      value={monto > 0 ? `$ ${formatearPesos(monto)}` : ''}
      onChangeText={(t) => onCambiar(soloDigitos(t).replace(/^0+/, '').slice(0, MAX_DIGITOS))}
      placeholder="$ 0"
      placeholderTextColor="#757B81"
      keyboardType="number-pad"
      inputMode="numeric"
      autoFocus={autoFocus}
      editable={editable}
      accessibilityLabel="Monto en pesos"
      className={cn('text-foreground outline-none', className)}
    />
  );
}
