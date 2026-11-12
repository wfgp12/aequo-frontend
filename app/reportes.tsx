import { FiltrosDeFecha } from '@/components/movimientos/filtros-de-fecha';
import { TarjetaEgresosPorCategoria } from '@/components/reportes/tarjeta-egresos-por-categoria';
import { TarjetaEvolucionBalance } from '@/components/reportes/tarjeta-evolucion-balance';
import { TarjetaIngresosEgresos } from '@/components/reportes/tarjeta-ingresos-egresos';
import { Text } from '@/components/ui/text';
import { hoy, mesActual, nombreDelMes, restarMeses } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

type Modo = 'mes' | 'rango';

const nombreCompleto = (mes: string) => {
  const nombre = nombreDelMes(Number(mes.slice(5, 7)) - 1);
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${mes.slice(0, 4)}`;
};

/**
 * Reportes (wireframe "Reportes" de Figma): las tres tarjetas del periodo elegido, por mes o por rango de
 * fechas. Cada pestaña recuerda lo elegido mientras la pantalla esté abierta; al salir se pierde.
 */
export default function Reportes() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('mes');
  const [mes, setMes] = useState(mesActual());
  const [desde, setDesde] = useState(`${mesActual()}-01`);
  const [hasta, setHasta] = useState(hoy());

  const esElMesActual = mes >= mesActual();
  const aviso =
    modo !== 'rango'
      ? null
      : !desde || !hasta
        ? 'Elige las dos fechas para ver tu reporte.'
        : desde > hasta
          ? 'La fecha Desde no puede ser posterior a la fecha Hasta.'
          : null;
  const periodo = modo === 'mes' ? { mes } : { desde, hasta };

  return (
    <View className="flex-1 bg-background px-5 pt-12">
      <ScrollView
        className="w-full max-w-[420px] flex-1 self-center"
        contentContainerClassName="gap-4 pb-8"
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text className="text-2xl">‹</Text>
          </Pressable>
          <Text className="text-xl font-bold">Reportes</Text>
        </View>

        <View accessibilityRole="tablist" className="flex-row gap-2">
          {(['mes', 'rango'] as const).map((valor) => (
            <Pressable
              key={valor}
              accessibilityRole="tab"
              accessibilityLabel={valor === 'mes' ? 'Mes' : 'Rango'}
              accessibilityState={{ selected: modo === valor }}
              onPress={() => setModo(valor)}
              className={cn(
                'min-h-11 flex-1 items-center justify-center rounded-lg border border-input',
                modo === valor && 'border-primary bg-primary',
              )}
            >
              <Text className={cn('font-semibold', modo === valor && 'text-primary-foreground')}>
                {valor === 'mes' ? 'Mes' : 'Rango'}
              </Text>
            </Pressable>
          ))}
        </View>

        {modo === 'mes' ? (
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
              onPress={() => setMes(restarMeses(mes, 1))}
              hitSlop={12}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <Text className="text-2xl">‹</Text>
            </Pressable>
            <Text className="text-lg font-semibold">{nombreCompleto(mes)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
              accessibilityState={{ disabled: esElMesActual }}
              disabled={esElMesActual}
              onPress={() => setMes(restarMeses(mes, -1))}
              hitSlop={12}
              className={cn(
                'min-h-11 min-w-11 items-center justify-center',
                esElMesActual && 'opacity-30',
              )}
            >
              <Text className="text-2xl">›</Text>
            </Pressable>
          </View>
        ) : (
          <FiltrosDeFecha
            desde={desde}
            hasta={hasta}
            onCambiar={(campo, iso) => (campo === 'desde' ? setDesde(iso) : setHasta(iso))}
          />
        )}

        {aviso ? (
          <Text variant="muted" className="text-center">
            {aviso}
          </Text>
        ) : (
          <>
            <TarjetaIngresosEgresos {...periodo} />
            <TarjetaEgresosPorCategoria {...periodo} />
            <TarjetaEvolucionBalance mes={modo === 'mes' ? mes : hasta.slice(0, 7)} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
