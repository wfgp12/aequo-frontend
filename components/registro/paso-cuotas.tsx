import { SelectorDeMes } from '@/components/selector-de-mes';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Tarjeta } from '@/lib/api/tarjetas';
import { formatearPesos, soloDigitos } from '@/lib/dinero';
import {
  leerCuotas,
  MAX_CUOTAS,
  NOTA_DE_LA_CUOTA,
  textoDeCuotas,
  textoDeTasa,
  type EleccionDeCuotas,
  type EleccionDeTarjeta,
} from '@/lib/tarjetas';
import { useCuotaPrevia, type VistaPrevia } from '@/lib/use-cuota-previa';
import { cn } from '@/lib/utils';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

const FIJAS = [1, 3, 6, 12];

type Props = {
  tarjeta: Tarjeta;
  /** Pesos que se van a pagar a cuotas. */
  valor: number;
  eleccion: EleccionDeCuotas;
  onCambiar: (cambios: Partial<EleccionDeTarjeta>) => void;
  /** Con la estimación vigente a la vista, la que se mostrará en el resumen. */
  onSiguiente: (previa: NonNullable<EleccionDeTarjeta['previa']>) => void;
  onAtras: () => void;
};

function OpcionDeCuotas({
  etiqueta,
  nombre,
  elegida,
  onPress,
}: {
  etiqueta: string;
  nombre: string;
  elegida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: elegida }}
      onPress={onPress}
      className={cn(
        'h-11 min-w-14 items-center justify-center rounded-full border border-border px-4',
        elegida && 'border-foreground bg-foreground',
      )}
    >
      <Text className={cn('font-semibold', elegida && 'text-background')}>{etiqueta}</Text>
    </Pressable>
  );
}

/** Lo que el backend estima para lo elegido: cargando, el error, o la cuota (y su nota) con más de una cuota. */
function CuotaEstimada({
  vista,
  cuotas,
  onReintentar,
}: {
  vista: VistaPrevia;
  cuotas: number | null;
  onReintentar: () => void;
}) {
  if (vista.estado === 'sin-consulta') return null;
  if (vista.estado === 'calculando') {
    return (
      <View className="mt-4 flex-row items-center gap-2">
        <ActivityIndicator accessibilityLabel="Calculando tu cuota" />
        <Text variant="muted">Calculando tu cuota</Text>
      </View>
    );
  }
  if (vista.estado === 'fallo') {
    return (
      <View className="mt-4 items-center gap-3">
        <Text variant="muted" role="alert" className="text-center text-destructive">
          {vista.fallo.mensaje}
        </Text>
        {vista.fallo.reintentar ? (
          <Button variant="outline" onPress={onReintentar}>
            <Text>Reintentar</Text>
          </Button>
        ) : null}
      </View>
    );
  }
  // Con una cuota y sin interés no hay nada que estimar; con interés, solo el backend sabe cuánto es
  if (cuotas === 1 && vista.cuota.cuotaUnicaSinInteres) {
    return (
      <Text variant="muted" className="mt-4">
        1 cuota: pago único, sin interés.
      </Text>
    );
  }
  return (
    <View className="mt-4 rounded-xl bg-muted p-3">
      <View className="flex-row items-center justify-between">
        <Text variant="muted">Cuota estimada</Text>
        <Text className="font-semibold">{`$ ${formatearPesos(vista.cuota.cuota)} x ${cuotas}`}</Text>
      </View>
      <Text variant="muted" className="mt-1 text-xs">
        {NOTA_DE_LA_CUOTA}
      </Text>
    </View>
  );
}

/**
 * Paso "¿Cuántas cuotas?" de la compra con tarjeta y del avance: cuotas (1, 3, 6, 12 u otra de 1 a 60), mes del primer
 * pago y la cuota estimada por el backend. Sin una estimación vigente no se puede avanzar.
 */
export function PasoCuotas({ tarjeta, valor, eleccion, onCambiar, onSiguiente, onAtras }: Props) {
  const { cuotas, otra, primerPago } = eleccion;
  const numero = otra ? leerCuotas(cuotas) : Number(cuotas);
  const { vista, reintentar } = useCuotaPrevia(tarjeta.id, valor, numero, primerPago);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Text variant="muted" className="mt-6 text-xs">
          {`${tarjeta.nombre} · ${textoDeTasa(tarjeta.tasaEA)}`}
        </Text>
        <Text className="mt-4 text-lg font-semibold">¿Cuántas cuotas?</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {FIJAS.map((n) => (
            <OpcionDeCuotas
              key={n}
              etiqueta={String(n)}
              nombre={textoDeCuotas(n)}
              elegida={!otra && Number(cuotas) === n}
              onPress={() => onCambiar({ cuotas: String(n), otra: false })}
            />
          ))}
          <OpcionDeCuotas
            etiqueta="Otra"
            nombre="Otra"
            elegida={otra}
            onPress={() => onCambiar({ otra: true, cuotas: otra ? cuotas : '' })}
          />
        </View>
        {otra ? (
          <>
            <TextInput
              value={cuotas}
              onChangeText={(texto) => onCambiar({ cuotas: soloDigitos(texto).slice(0, 2) })}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Número de cuotas"
              placeholder="Número de cuotas"
              placeholderTextColor="#757B81"
              className="mt-3 h-11 rounded-lg border border-input bg-background px-3 text-foreground"
            />
            {cuotas !== '' && numero === null ? (
              <Text variant="muted" role="alert" className="mt-2 text-xs text-destructive">
                {`Las cuotas van de 1 a ${MAX_CUOTAS}.`}
              </Text>
            ) : null}
          </>
        ) : null}

        <Text className="mt-6 text-lg font-semibold">¿En qué mes pagas la primera cuota?</Text>
        <SelectorDeMes mes={primerPago} onCambiar={(mes) => onCambiar({ primerPago: mes })} />

        <CuotaEstimada vista={vista} cuotas={numero} onReintentar={reintentar} />
      </ScrollView>

      <View className="mt-3 flex-row gap-3">
        <Button variant="outline" className="h-[50px] flex-1" onPress={onAtras}>
          <Text className="font-semibold">Atrás</Text>
        </Button>
        <Button
          className="h-[50px] flex-1"
          disabled={vista.estado !== 'lista'}
          onPress={() => {
            if (vista.estado === 'lista') onSiguiente(vista.cuota);
          }}
        >
          <Text className="font-semibold">Siguiente</Text>
        </Button>
      </View>
    </View>
  );
}
