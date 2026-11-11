import { Text } from '@/components/ui/text';
import { BarChart } from 'react-native-gifted-charts';
import { View } from 'react-native';
import { ANCHO_EJE_Y, pesos, useTemaGrafica, type PuntoGrafica } from './use-tema-grafica';

type Props = {
  datos: PuntoGrafica[];
  descripcion: string;
  /** Relleno del contenedor que hay que restar al ancho disponible. */
  margenExtra?: number;
};

/** Barras de un valor por categoría o periodo (RF-17), con su valor en pesos encima. Los datos llegan calculados. */
export function GraficaBarras({ datos, descripcion, margenExtra }: Props) {
  const { colores, ancho } = useTemaGrafica(margenExtra);
  const lugar = (ancho - ANCHO_EJE_Y) / Math.max(datos.length, 1);
  const textoEje = { color: colores.textoSecundario, fontSize: 11 };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={descripcion}>
      <BarChart
        data={datos.map((d) => ({
          value: d.valor,
          label: d.etiqueta,
          frontColor: d.color ?? colores.acento,
          // Más ancho que la barra y en una línea, para que el monto no se parta cuando la barra es angosta
          topLabelComponent: () => (
            <Text
              numberOfLines={1}
              className="mb-1 text-center text-xs font-semibold"
              style={{ width: lugar }}
            >
              {pesos(d.valor)}
            </Text>
          ),
        }))}
        width={ancho - ANCHO_EJE_Y}
        barWidth={lugar * 0.55}
        spacing={lugar * 0.45}
        initialSpacing={lugar * 0.2}
        endSpacing={0}
        barBorderRadius={4}
        noOfSections={4}
        yAxisLabelWidth={ANCHO_EJE_Y}
        formatYLabel={(valor) => pesos(Number(valor))}
        yAxisTextStyle={textoEje}
        xAxisLabelTextStyle={textoEje}
        xAxisColor={colores.lineas}
        yAxisColor="transparent"
        rulesColor={colores.lineas}
        disableScroll
      />
    </View>
  );
}
