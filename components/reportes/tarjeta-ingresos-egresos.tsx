import { GraficaBarras } from '@/components/graficas/grafica-barras';
import { pesos, useTemaGrafica } from '@/components/graficas/use-tema-grafica';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useReportePeriodo } from '@/lib/use-reporte-periodo';
import { ActivityIndicator, View } from 'react-native';

// Relleno (p-4) y borde de la tarjeta: se descuentan para que la gráfica no se salga de ella
const RELLENO_TARJETA = 34;

type Props = { mes?: string; desde?: string; hasta?: string };

/** Tarjeta "Ingresos vs egresos" del periodo (RF-17): dos barras con los totales que calcula el backend. */
export function TarjetaIngresosEgresos(periodo: Props) {
  const { reporte, cargando, error, reintentar } = useReportePeriodo(periodo);
  // De la serie de la paleta: grafito (blanco en oscuro) para Ingresos y gris para Egresos
  const [, colorIngresos, colorEgresos] = useTemaGrafica().colores.serie;

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text variant="large">Ingresos vs egresos</Text>
      {cargando ? (
        <View className="items-center justify-center py-6">
          <ActivityIndicator accessibilityLabel="Cargando ingresos y egresos" />
        </View>
      ) : error ? (
        <View className="items-center justify-center gap-4 py-6">
          <Text variant="muted" role="alert" className="text-center">
            {error}
          </Text>
          <Button variant="outline" onPress={reintentar}>
            <Text>Reintentar</Text>
          </Button>
        </View>
      ) : reporte && reporte.ingresos === 0 && reporte.egresos === 0 ? (
        <Text variant="muted" className="py-6 text-center">
          No hay movimientos en este periodo.
        </Text>
      ) : reporte ? (
        <GraficaBarras
          margenExtra={RELLENO_TARJETA}
          descripcion={`Ingresos de ${pesos(reporte.ingresos)} y egresos de ${pesos(reporte.egresos)}`}
          datos={[
            { etiqueta: 'Ingresos', valor: reporte.ingresos, color: colorIngresos },
            { etiqueta: 'Egresos', valor: reporte.egresos, color: colorEgresos },
          ]}
        />
      ) : null}
    </View>
  );
}
