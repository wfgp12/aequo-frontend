import { LineChart } from 'react-native-gifted-charts';
import { View } from 'react-native';
import { ANCHO_EJE_Y, pesos, useTemaGrafica, type PuntoGrafica } from './use-tema-grafica';

type Props = { datos: PuntoGrafica[]; descripcion: string };

/** Línea de tiempo de un valor a lo largo de los periodos (RF-19). Los datos llegan calculados. */
export function GraficaLinea({ datos, descripcion }: Props) {
  const { colores, ancho } = useTemaGrafica();
  const lugar = (ancho - ANCHO_EJE_Y) / Math.max(datos.length, 1);
  const textoEje = { color: colores.textoSecundario, fontSize: 11 };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={descripcion}>
      <LineChart
        data={datos.map((d) => ({ value: d.valor, label: d.etiqueta }))}
        width={ancho - ANCHO_EJE_Y}
        spacing={lugar}
        initialSpacing={lugar / 2}
        endSpacing={0}
        color={colores.acento}
        thickness={3}
        dataPointsColor={colores.acento}
        areaChart
        startFillColor={colores.acento}
        endFillColor={colores.acento}
        startOpacity={0.3}
        endOpacity={0}
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
