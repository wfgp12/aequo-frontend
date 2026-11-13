import { FormularioMeta } from '@/components/ahorro/formulario-meta';
import { TarjetaProgresoAhorro } from '@/components/ahorro/tarjeta-progreso-ahorro';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { mesActual, nombreDelMes } from '@/lib/fechas';
import { useMetaDelMes } from '@/lib/use-meta-del-mes';
import { useProgresoAhorro } from '@/lib/use-progreso-ahorro';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

/**
 * Meta de ahorro (wireframe "Meta de ahorro" de Figma): fija, cambia y quita la meta del mes actual, como monto
 * fijo o como porcentaje de los ingresos. El formulario aparece cuando se sabe si ya hay meta del mes.
 */
export default function MetaDeAhorro() {
  const router = useRouter();
  const mes = mesActual();
  const mesLargo = `${nombreDelMes(Number(mes.slice(5, 7)) - 1)} de ${mes.slice(0, 4)}`;
  const { cargando, meta, error, recargar } = useMetaDelMes(mes);
  // Cada carga es independiente: el progreso no espera a la meta ni al revés
  const avance = useProgresoAhorro(mes);

  return (
    <View className="flex-1 bg-background px-5 pt-12">
      <ScrollView
        className="w-full max-w-[420px] flex-1 self-center"
        contentContainerClassName="gap-4 pb-8"
        keyboardShouldPersistTaps="handled"
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
          <Text className="text-xl font-bold">Meta de ahorro</Text>
        </View>

        <TarjetaProgresoAhorro
          mes={mes}
          cargando={avance.cargando}
          progreso={avance.progreso}
          error={avance.error}
          onReintentar={avance.recargar}
        />

        {cargando ? (
          <View className="items-center py-10">
            <ActivityIndicator accessibilityLabel="Cargando tu meta de ahorro" />
          </View>
        ) : error ? (
          <View className="items-center gap-3 py-6">
            <Text variant="muted" role="alert" className="text-center">
              {error}
            </Text>
            <Button variant="outline" onPress={recargar}>
              <Text>Reintentar</Text>
            </Button>
          </View>
        ) : (
          <FormularioMeta
            metaInicial={meta}
            mes={mes}
            mesLargo={mesLargo}
            onMetaCambiada={avance.recargar}
          />
        )}
      </ScrollView>
    </View>
  );
}
