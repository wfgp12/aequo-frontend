import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

type Props = {
  /** Lo que se registró, en una frase. */
  mensaje: string;
  /** Una frase más que explica qué significa lo registrado. */
  aclaracion?: string;
  /** Más líneas bajo el mensaje (por ejemplo, lo pagado frente a lo estimado). */
  children?: ReactNode;
  onCerrar: () => void;
};

/** "¡Listo!" al terminar un registro (movimiento, compra con tarjeta o avance). */
export function Confirmacion({ mensaje, aclaracion, children, onCerrar }: Props) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-2xl font-semibold">¡Listo!</Text>
        <Text variant="muted" className="text-center">
          {mensaje}
        </Text>
        {aclaracion ? (
          <Text variant="muted" className="text-center">
            {aclaracion}
          </Text>
        ) : null}
        {children}
      </View>
      <Button className="h-[50px] w-full" onPress={onCerrar}>
        <Text className="font-semibold">Listo</Text>
      </Button>
    </View>
  );
}
