import { FiltrosDeFecha } from '@/components/movimientos/filtros-de-fecha';
import { FilaMovimiento } from '@/components/movimientos/fila-movimiento';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { encabezadoDeDia, hoy } from '@/lib/fechas';
import { agruparPorDia } from '@/lib/movimientos';
import { useMovimientos } from '@/lib/use-movimientos';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';

/**
 * Lista de movimientos (wireframe "Movimientos", de Figma): más recientes primero, agrupados por día, con
 * filtros Desde/Hasta independientes del periodo del dashboard y carga progresiva al llegar al final.
 * Como en el diseño, "Hasta" empieza en hoy.
 */
export default function Movimientos() {
  const router = useRouter();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState(hoy());
  const { items, cargando, error, hayMas, cargandoMas, errorAlCargarMas, cargarMas, recargar } =
    useMovimientos({ desde: desde || undefined, hasta: hasta || undefined });
  const secciones = useMemo(() => agruparPorDia(items), [items]);

  return (
    <View className="flex-1 bg-background px-5 pt-12">
      <View className="w-full max-w-[420px] flex-1 self-center">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Text className="text-2xl">‹</Text>
          </Pressable>
          <Text className="text-xl font-bold">Movimientos</Text>
        </View>

        <View className="mt-4">
          <FiltrosDeFecha
            desde={desde}
            hasta={hasta}
            onCambiar={(campo, iso) => (campo === 'desde' ? setDesde(iso) : setHasta(iso))}
          />
        </View>

        {cargando ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator accessibilityLabel="Cargando tus movimientos" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center gap-4">
            <Text variant="muted" role="alert" className="text-center">
              {error}
            </Text>
            <Button variant="outline" onPress={recargar}>
              <Text>Reintentar</Text>
            </Button>
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text variant="muted" className="text-center">
              No hay movimientos en este periodo.
            </Text>
          </View>
        ) : (
          <SectionList
            testID="lista-movimientos"
            className="mt-4"
            sections={secciones}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <Text variant="muted" className="mb-2 mt-3 bg-background text-xs font-semibold">
                {encabezadoDeDia(section.fecha)}
              </Text>
            )}
            renderItem={({ item }) => <FilaMovimiento item={item} />}
            stickySectionHeadersEnabled={false}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hayMas) void cargarMas();
            }}
            ListFooterComponent={
              <View className="items-center py-4">
                {cargandoMas ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator />
                    <Text variant="muted" className="text-xs">
                      Cargando más…
                    </Text>
                  </View>
                ) : errorAlCargarMas ? (
                  <View className="items-center gap-2">
                    <Text variant="muted" role="alert" className="text-center text-xs">
                      {errorAlCargarMas}
                    </Text>
                    <Button
                      variant="outline"
                      onPress={() => {
                        void cargarMas();
                      }}
                    >
                      <Text>Reintentar</Text>
                    </Button>
                  </View>
                ) : null}
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
