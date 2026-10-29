import { Calendario } from '@/components/calendario';
import { Text } from '@/components/ui/text';
import { fechaDdMmAaaa, hoy } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

type Campo = 'desde' | 'hasta';

type Props = {
  /** Fechas en formato YYYY-MM-DD; vacío significa sin límite. */
  desde: string;
  hasta: string;
  onCambiar: (campo: Campo, iso: string) => void;
};

/** Filtros "Desde" y "Hasta" de la lista de movimientos, cada uno con su calendario. */
export function FiltrosDeFecha({ desde, hasta, onCambiar }: Props) {
  const [abierto, setAbierto] = useState<Campo | null>(null);
  const valores = { desde, hasta };

  function alternar(campo: Campo) {
    setAbierto((actual) => (actual === campo ? null : campo));
  }

  return (
    <View>
      <View className="flex-row gap-3">
        {(['desde', 'hasta'] as const).map((campo) => (
          <View key={campo} className="flex-1">
            <Text className="text-xs font-semibold capitalize">{campo}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${campo === 'desde' ? 'Desde' : 'Hasta'}: ${
                valores[campo] ? fechaDdMmAaaa(valores[campo]) : 'sin fecha'
              }`}
              accessibilityState={{ expanded: abierto === campo }}
              onPress={() => alternar(campo)}
              className={cn(
                'mt-1 h-11 flex-row items-center justify-between rounded-lg border border-input bg-background px-3',
                abierto === campo && 'border-foreground',
              )}
            >
              <Text className={cn('text-sm', !valores[campo] && 'text-muted-foreground')}>
                {valores[campo] ? fechaDdMmAaaa(valores[campo]) : 'dd/mm/aaaa'}
              </Text>
              <Text className="text-xs">📅</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {abierto ? (
        <View className="mt-3 gap-2">
          <Calendario
            valor={valores[abierto] || hoy()}
            onElegir={(iso) => {
              onCambiar(abierto, iso);
              setAbierto(null);
            }}
          />
          {valores[abierto] ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onCambiar(abierto, '');
                setAbierto(null);
              }}
              hitSlop={8}
            >
              <Text variant="muted" className="text-center text-xs underline">
                Quitar esta fecha
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
