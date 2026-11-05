import { BarChart } from 'react-native-gifted-charts';
import { View } from 'react-native';
import { ANCHO_EJE_Y, pesos, useTemaGrafica, type PuntoGrafica } from './use-tema-grafica';

type Props = { datos: PuntoGrafica[]; descripcion: string };

/** Barras de un valor por categoría o periodo (RF-17). Los datos llegan calculados. */
export function GraficaBarras({ datos, descripcion }: Props) {
  const { colores, ancho } = useTemaGrafica();
  const lugar = (ancho - ANCHO_EJE_Y) / Math.max(datos.length, 1);
  const textoEje = { color: colores.textoSecundario, fontSize: 11 };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={descripcion}>
      <BarChart
        data={datos.map((d) => ({ value: d.valor, label: d.etiqueta, frontColor: colores.acento }))}
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
