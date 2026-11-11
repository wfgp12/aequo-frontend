import { pesos, useTemaGrafica } from '@/components/graficas/use-tema-grafica';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { CategoriaGasto } from '@/lib/api/reportes';
import { useReporteCategorias } from '@/lib/use-reporte-categorias';
import { ActivityIndicator, Pressable, View } from 'react-native';

type Props = {
  mes?: string;
  desde?: string;
  hasta?: string;
  /** Si llega, las categorías con id se pueden tocar para ver sus movimientos (3.3.1 lo conecta). */
  onElegirCategoria?: (categoriaId: string, nombre: string) => void;
};

type FilaProps = {
  categoria: CategoriaGasto;
  colorBarra: string;
  colorRiel: string;
  onPress?: () => void;
};

/** Una categoría: nombre y monto, con su barra (el porcentaje ya viene calculado por el backend). */
function Fila({ categoria, colorBarra, colorRiel, onPress }: FilaProps) {
  const contenido = (
    <>
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1">
          {categoria.nombre}
        </Text>
        <Text>{pesos(categoria.total)}</Text>
        {onPress ? <Text variant="muted">&gt;</Text> : null}
      </View>
      <View
        testID="riel-categoria"
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: colorRiel }}
      >
        <View
          testID="barra-categoria"
          className="h-2 rounded-full"
          style={{ width: `${categoria.porcentaje}%`, backgroundColor: colorBarra }}
        />
      </View>
    </>
  );
  const etiqueta = `${categoria.nombre}, ${pesos(categoria.total)}`;

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      className="min-h-14 justify-center gap-2"
    >
      {contenido}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={etiqueta} className="min-h-14 justify-center gap-2">
      {contenido}
    </View>
  );
}

/** Tarjeta "Egresos por categoría" del periodo (RF-18): una barra por categoría con lo que calcula el backend. */
export function TarjetaEgresosPorCategoria({ onElegirCategoria, ...periodo }: Props) {
  const { reporte, cargando, error, reintentar } = useReporteCategorias(periodo);
  const { colores } = useTemaGrafica();
  const hayEgresos = reporte !== null && reporte.total !== 0 && reporte.categorias.length > 0;

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text variant="large">Egresos por categoría</Text>
      {hayEgresos && onElegirCategoria ? (
        <Text variant="muted">Toca una categoría para ver sus movimientos</Text>
      ) : null}
      {cargando ? (
        <View className="items-center justify-center py-6">
          <ActivityIndicator accessibilityLabel="Cargando egresos por categoría" />
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
      ) : reporte && !hayEgresos ? (
        <Text variant="muted" className="py-6 text-center">
          No hay egresos en este periodo.
        </Text>
      ) : reporte ? (
        reporte.categorias.map((c, i) => (
          <Fila
            key={c.categoriaId ?? `sin-categoria-${i}`}
            categoria={c}
            colorBarra={colores.serie[1]}
            colorRiel={colores.lineas}
            // "Sin categoría" no tiene movimientos que listar por id: no es botón
            onPress={
              onElegirCategoria && c.categoriaId !== null
                ? () => onElegirCategoria(c.categoriaId as string, c.nombre)
                : undefined
            }
          />
        ))
      ) : null}
    </View>
  );
}
