import { Text } from '@/components/ui/text';
import { PieChart } from 'react-native-gifted-charts';
import { View } from 'react-native';
import { pesos, useTemaGrafica, type PuntoGrafica } from './use-tema-grafica';

type Props = { datos: PuntoGrafica[]; descripcion: string; centro?: string };

/** Dona con su leyenda (RF-18). La leyenda repite el valor para no depender solo del color. */
export function GraficaDona({ datos, descripcion, centro }: Props) {
  const { colores } = useTemaGrafica();
  const colorDe = (i: number) => colores.serie[i % colores.serie.length];

  return (
    <View className="items-center gap-4" accessible accessibilityLabel={descripcion}>
      <PieChart
        donut
        radius={90}
        innerRadius={58}
        innerCircleColor={colores.fondo}
        data={datos.map((d, i) => ({ value: d.valor, color: colorDe(i) }))}
        centerLabelComponent={() => (
          <Text className="text-center text-sm font-semibold">{centro}</Text>
        )}
      />
      <View className="w-full gap-2">
        {datos.map((d, i) => (
          <View key={d.etiqueta} className="min-h-8 flex-row items-center gap-3">
            <View className="size-3 rounded-full" style={{ backgroundColor: colorDe(i) }} />
            <Text className="flex-1">{d.etiqueta}</Text>
            <Text className="font-semibold">{pesos(d.valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
