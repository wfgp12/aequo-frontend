import { GraficaLinea } from '@/components/graficas/grafica-linea';
import { useTemaGrafica } from '@/components/graficas/use-tema-grafica';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { mesActual, mesCorto, nombreDelMes, restarMeses } from '@/lib/fechas';
import { useReporteEvolucion } from '@/lib/use-reporte-evolucion';
import { ActivityIndicator, View } from 'react-native';

type Props = {
  /** Mes final (YYYY-MM); sin él, el mes actual del dispositivo. */
  mes?: string;
};

/** "septiembre" o, si hace falta distinguir el año, "septiembre de 2025". */
const nombreCompleto = (periodo: string, conAnio: boolean) =>
  `${nombreDelMes(Number(periodo.slice(5, 7)) - 1)}${conAnio ? ` de ${periodo.slice(0, 4)}` : ''}`;

/** Tarjeta "Evolución del balance" (RF-19): una línea con el balance de cada uno de los últimos 6 meses. */
export function TarjetaEvolucionBalance({ mes }: Props) {
  const hasta = mes ?? mesActual();
  const desde = restarMeses(hasta, 5);
  const { reporte, cargando, error, reintentar } = useReporteEvolucion({ desde, hasta });
  const { colores } = useTemaGrafica();
  const cruzaAnio = desde.slice(0, 4) !== hasta.slice(0, 4);

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text variant="large">Evolución del balance</Text>
      <Text variant="muted">Últimos 6 meses hasta {nombreCompleto(hasta, false)}</Text>
      {cargando ? (
        <View className="items-center justify-center py-6">
          <ActivityIndicator accessibilityLabel="Cargando evolución del balance" />
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
      ) : reporte && reporte.puntos.length === 0 ? (
        <Text variant="muted" className="py-6 text-center">
          No hay movimientos en estos meses.
        </Text>
      ) : reporte ? (
        <GraficaLinea
          datos={reporte.puntos.map((p) => ({ etiqueta: mesCorto(p.periodo), valor: p.balance }))}
          descripcion={`Evolución del balance de ${nombreCompleto(desde, cruzaAnio)} a ${nombreCompleto(hasta, cruzaAnio)}`}
          color={colores.serie[1]}
          // Relleno de la tarjeta (p-4 + borde), como en las otras tarjetas
          margenExtra={34}
        />
      ) : null}
    </View>
  );
}
