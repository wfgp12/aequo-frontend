import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatearPesos } from '@/lib/dinero';
import { fechaCorta } from '@/lib/fechas';
import { MAX_DESCRIPCION } from '@/lib/api/transacciones';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';

export type ResumenRegistro = {
  monto: number;
  /** El avance en efectivo no tiene categoría ni método de pago. */
  categoria?: string;
  metodo?: string;
  fecha: string;
};

export type FilaDeResumen = { etiqueta: string; valor: string };

type Props = {
  descripcion: string;
  onCambiar: (texto: string) => void;
  resumen: ResumenRegistro;
  /** Filas propias de la tarjeta (tarjeta, cuotas, cuota estimada, primer y último pago), antes de la fecha. */
  detalles?: FilaDeResumen[];
  /** Notas al pie del resumen. */
  avisos?: string[];
  guardando: boolean;
  error: string | null;
  onAtras: () => void;
  onGuardar: () => void;
};

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text variant="muted" className="text-xs">
        {etiqueta}
      </Text>
      <Text className="text-xs font-semibold">{valor}</Text>
    </View>
  );
}

/** Paso 5: nota opcional y resumen para revisar todo antes de guardar. */
export function PasoDescripcion({
  descripcion,
  onCambiar,
  resumen,
  detalles = [],
  avisos = [],
  guardando,
  error,
  onAtras,
  onGuardar,
}: Props) {
  return (
    <View className="flex-1">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <Text className="mt-6 text-lg font-semibold">¿Quieres agregar una nota?</Text>
        <Text variant="muted" className="mt-1 text-xs">
          Opcional
        </Text>
        <TextInput
          value={descripcion}
          onChangeText={(t) => onCambiar(t.slice(0, MAX_DESCRIPCION))}
          placeholder="Ej: almuerzo con el equipo"
          placeholderTextColor="#757B81"
          accessibilityLabel="Nota"
          maxLength={MAX_DESCRIPCION}
          editable={!guardando}
          className="mt-2 h-11 rounded-lg border border-input bg-background px-3 text-foreground"
        />

        <View className="mt-4 rounded-xl bg-muted p-3">
          <Text className="text-xs font-semibold">Resumen</Text>
          <Fila etiqueta="Valor" valor={`$ ${formatearPesos(resumen.monto)}`} />
          {resumen.categoria === undefined ? null : (
            <Fila etiqueta="Categoría" valor={resumen.categoria} />
          )}
          {resumen.metodo === undefined ? null : <Fila etiqueta="Método" valor={resumen.metodo} />}
          {detalles.map(({ etiqueta, valor }) => (
            <Fila key={etiqueta} etiqueta={etiqueta} valor={valor} />
          ))}
          <Fila etiqueta="Fecha" valor={fechaCorta(resumen.fecha)} />
        </View>
        {avisos.map((aviso) => (
          <Text key={aviso} variant="muted" className="mt-2 text-xs">
            {aviso}
          </Text>
        ))}
      </ScrollView>

      <View className="mt-3">
        {error ? (
          <Text variant="muted" role="alert" className="mb-3 text-center text-xs text-destructive">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className="h-[50px] flex-1"
            onPress={onAtras}
            disabled={guardando}
          >
            <Text className="font-semibold">Atrás</Text>
          </Button>
          <Button className="h-[50px] flex-1" onPress={onGuardar} disabled={guardando}>
            {guardando ? <ActivityIndicator /> : <Text className="font-semibold">Guardar</Text>}
          </Button>
        </View>
      </View>
    </View>
  );
}
