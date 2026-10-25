import { Text } from '@/components/ui/text';
import { aFechaIso, desdeFechaIso, fechaLarga, nombreDelMes } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

type Props = {
  /** Fecha elegida, en formato YYYY-MM-DD. */
  valor: string;
  onElegir: (iso: string) => void;
};

/** Calendario mensual simple (semana desde el lunes), igual en web, Android e iPhone y sin dependencias. */
export function Calendario({ valor, onElegir }: Props) {
  const elegida = desdeFechaIso(valor);
  const [anio, setAnio] = useState(elegida.getFullYear());
  const [mes, setMes] = useState(elegida.getMonth());

  const primerDia = new Date(anio, mes, 1, 12);
  const huecos = (primerDia.getDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array<null>(huecos).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];

  function moverMes(delta: number) {
    const nuevo = new Date(anio, mes + delta, 1, 12);
    setAnio(nuevo.getFullYear());
    setMes(nuevo.getMonth());
  }

  return (
    <View className="rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          onPress={() => moverMes(-1)}
          hitSlop={12}
        >
          <Text className="px-2 text-xl">‹</Text>
        </Pressable>
        <Text className="font-semibold">
          {conMayuscula(nombreDelMes(mes))} de {anio}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          onPress={() => moverMes(1)}
          hitSlop={12}
        >
          <Text className="px-2 text-xl">›</Text>
        </Pressable>
      </View>

      <View className="mt-2 flex-row">
        {SEMANA.map((d) => (
          <Text key={d} variant="muted" className="flex-1 text-center text-xs">
            {d}
          </Text>
        ))}
      </View>

      <View className="mt-1 flex-row flex-wrap">
        {celdas.map((dia, i) => {
          if (dia === null) return <View key={`hueco-${i}`} className="h-10 w-[14.2857%]" />;
          const iso = aFechaIso(new Date(anio, mes, dia, 12));
          const activo = iso === valor;
          return (
            <View key={iso} className="h-10 w-[14.2857%] items-center justify-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fechaLarga(iso)}
                accessibilityState={{ selected: activo }}
                onPress={() => onElegir(iso)}
                className={cn(
                  'size-9 items-center justify-center rounded-full',
                  activo && 'bg-primary',
                )}
              >
                <Text className={cn('text-sm', activo && 'font-semibold text-primary-foreground')}>
                  {dia}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
