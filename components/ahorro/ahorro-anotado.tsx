import { HojaAhorro } from '@/components/ahorro/hoja-ahorro';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { AhorroAcumulado } from '@/lib/api/ahorro';
import { pesosConSigno } from '@/lib/dinero';
import { mesEnLetras } from '@/lib/fechas';
import type { useAhorroAcumulado } from '@/lib/use-ahorro-acumulado';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

type Mes = AhorroAcumulado['meses'][number];

/** Un mes con meta: lo anotado, lo que se lleva hasta ese mes y el botón para anotarlo o cambiarlo. */
function FilaDeMes({ mes, onElegir }: { mes: Mes; onElegir: () => void }) {
  const nombre = mesEnLetras(mes.periodo);
  // El backend no distingue "no lo escribí" de 0
  const sinAnotar = mes.ahorroReal === 0;
  const anotado = sinAnotar ? 'Sin anotar' : `Anotaste ${pesosConSigno(mes.ahorroReal)}`;
  const llevas = `Llevas ${pesosConSigno(mes.acumulado)}`;
  const accion = sinAnotar ? 'Anotar' : 'Cambiar';

  return (
    <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
      <View
        accessible
        accessibilityLabel={`${nombre}, ${anotado.toLowerCase()}, ${llevas.toLowerCase()}`}
        className="flex-1"
      >
        <Text className="font-semibold">{nombre}</Text>
        <Text>{anotado}</Text>
        <Text variant="muted">{llevas}</Text>
      </View>
      <Button
        variant="outline"
        className="min-h-11"
        accessibilityRole="button"
        accessibilityLabel={`${accion} el ahorro de ${nombre}`}
        onPress={onElegir}
      >
        <Text>{accion}</Text>
      </Button>
    </View>
  );
}

type Props = ReturnType<typeof useAhorroAcumulado>;

function Contenido({
  cargando,
  dato,
  fallo,
  recargar,
  onElegir,
}: Props & { onElegir: (mes: Mes) => void }) {
  if (cargando)
    return (
      <View className="items-center py-6">
        <ActivityIndicator accessibilityLabel="Cargando tu ahorro anotado" />
      </View>
    );

  if (!dato)
    return (
      <View className="items-center gap-3 py-2">
        <Text variant="muted" role="alert" className="text-center">
          {fallo?.mensaje}
        </Text>
        <Button
          variant="outline"
          accessibilityRole="button"
          accessibilityLabel="Reintentar ahorro anotado"
          onPress={recargar}
        >
          <Text>Reintentar</Text>
        </Button>
      </View>
    );

  if (dato.meses.length === 0)
    return (
      <Text variant="muted">
        Todavía no hay meses con meta. Cuando fijes tu meta, podrás anotar aquí cuánto ahorraste.
      </Text>
    );

  const total = pesosConSigno(dato.total);
  return (
    <>
      <View accessible accessibilityLabel={`Total anotado, ${total}`}>
        <Text variant="muted">Total anotado</Text>
        <Text className="text-xl font-bold">{total}</Text>
      </View>
      {/* El backend los entrega del más antiguo al más reciente */}
      {[...dato.meses].reverse().map((mes) => (
        <FilaDeMes key={mes.periodo} mes={mes} onElegir={() => onElegir(mes)} />
      ))}
    </>
  );
}

/** "Ahorro que has anotado" (RF-23): lo que el usuario escribió cada mes; las sumas las calcula el backend. */
export function AhorroAnotado(acumulado: Props) {
  // Copia de la fila elegida: la hoja sigue abierta aunque la fila desaparezca al recargar
  const [elegido, setElegido] = useState<Mes | null>(null);

  return (
    <View className="mt-2 gap-3">
      <Text variant="large">Ahorro que has anotado</Text>
      <Contenido {...acumulado} onElegir={setElegido} />
      {elegido ? (
        <HojaAhorro
          periodo={elegido.periodo}
          ahorroReal={elegido.ahorroReal}
          onCerrar={() => setElegido(null)}
          onCambio={acumulado.recargar}
        />
      ) : null}
    </View>
  );
}
