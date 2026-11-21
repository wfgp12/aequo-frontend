import { DialogoEliminar } from '@/components/tarjetas/dialogo-eliminar';
import { Text } from '@/components/ui/text';
import { eliminarPago, type PagoTarjeta } from '@/lib/api/tarjetas';
import { formatearPesos } from '@/lib/dinero';
import { fechaCorta, mesActual, mesEnLetras } from '@/lib/fechas';
import { ETIQUETA_METODO } from '@/lib/movimientos';
import { mensajeAlEliminarPago } from '@/lib/tarjetas';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

type Props = {
  tarjetaId: string;
  /** YYYY-MM */
  mes: string;
  /** Los pagos del mes, en el orden en que los entregó el backend. */
  pagos: PagoTarjeta[];
  /** Se eliminó un pago (o ya no existía): las cifras y la lista deben volver a pedirse. */
  onCambio: () => void;
};

const pesos = (valor: number) => `$ ${formatearPesos(valor)}`;

/** Los pagos que registró el usuario en el mes, cada uno con su botón de eliminar (los pagos no se editan). */
export function PagosDelMes({ tarjetaId, mes, pagos, onCambio }: Props) {
  const [porEliminar, setPorEliminar] = useState<PagoTarjeta | null>(null);
  if (pagos.length === 0) return null;

  return (
    <>
      <Text className="mt-2 text-lg font-semibold">
        {mes === mesActual() ? 'Tus pagos de este mes' : `Tus pagos de ${mesEnLetras(mes)}`}
      </Text>
      {pagos.map((pago) => {
        const fecha = fechaCorta(pago.fecha);
        const metodo = ETIQUETA_METODO[pago.metodoPago];
        return (
          <View
            key={pago.id}
            className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-2"
          >
            <View
              accessible
              accessibilityLabel={`${pago.descripcion}, ${pesos(pago.valor)}, ${fecha}, ${metodo}`}
              className="flex-1"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-semibold">{pago.descripcion}</Text>
                <Text className="font-semibold">{pesos(pago.valor)}</Text>
              </View>
              <Text variant="muted">{`${fecha} · ${metodo}`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar el pago de ${pesos(pago.valor)}, ${fecha}`}
              onPress={() => setPorEliminar(pago)}
              hitSlop={8}
              className="min-h-11 justify-center"
            >
              <Text className="text-sm font-semibold text-destructive">Eliminar</Text>
            </Pressable>
          </View>
        );
      })}

      {porEliminar ? (
        <DialogoEliminar
          titulo="¿Eliminar este pago?"
          detalle={`${porEliminar.descripcion} · ${pesos(porEliminar.valor)} · ${fechaCorta(porEliminar.fecha)}. Esta acción no se puede deshacer.`}
          eliminar={() => eliminarPago(tarjetaId, porEliminar.id)}
          mensajeDeError={mensajeAlEliminarPago}
          onCancelar={() => setPorEliminar(null)}
          onEliminado={() => {
            setPorEliminar(null);
            onCambio();
          }}
        />
      ) : null}
    </>
  );
}
