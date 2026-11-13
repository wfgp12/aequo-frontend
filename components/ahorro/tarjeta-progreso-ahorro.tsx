import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { ProgresoAhorro } from '@/lib/api/ahorro';
import { formatearPesos } from '@/lib/dinero';
import { nombreDelMes } from '@/lib/fechas';
import { ActivityIndicator, View } from 'react-native';

/** "$ 250.000" o "-$ 250.000": se redondea al peso solo al mostrar y un cero nunca lleva signo. */
function pesosConSigno(valor: number) {
  const redondeado = Math.round(valor);
  return `${redondeado < 0 ? '-' : ''}$ ${formatearPesos(Math.abs(redondeado))}`;
}

/** "2026-09" → "Septiembre 2026" */
function mesConAnio(mes: string) {
  const nombre = nombreDelMes(Number(mes.slice(5, 7)) - 1);
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${mes.slice(0, 4)}`;
}

/** Barra de avance: solo su largo se limita de 0 a 100; el texto del porcentaje muestra el valor real. */
function BarraDeAvance({ porcentaje }: { porcentaje: number }) {
  const ahora = Math.min(100, Math.max(0, Math.round(porcentaje)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Avance de tu meta de ahorro"
      accessibilityValue={{ min: 0, max: 100, now: ahora }}
      className="h-3 overflow-hidden rounded-full bg-muted"
    >
      <View className="h-full rounded-full bg-primary" style={{ width: `${ahora}%` }} />
    </View>
  );
}

/** Lo que dice la tarjeta de la meta: lo que falta o que ya se cumplió. Lee `disponible`, no calcula nada. */
function Avance({ progreso, porcentaje }: { progreso: ProgresoAhorro; porcentaje: number }) {
  const disponible = Math.round(progreso.disponible);
  return (
    <>
      <Text className="text-3xl font-bold">{`${Math.round(porcentaje)}%`}</Text>
      <BarraDeAvance porcentaje={porcentaje} />
      {disponible < 0 ? (
        <Text variant="muted">{`Te faltan ${pesosConSigno(-disponible)} para tu meta`}</Text>
      ) : (
        <>
          <Text className="font-semibold">¡Cumpliste tu meta de este mes!</Text>
          {disponible > 0 ? (
            <Text variant="muted">{`Ahorraste ${pesosConSigno(disponible)} más de lo que querías.`}</Text>
          ) : null}
        </>
      )}
    </>
  );
}

function Detalle({ progreso }: { progreso: ProgresoAhorro }) {
  if (!progreso.meta)
    return (
      <Text variant="muted">
        Todavía no fijaste tu meta de este mes. Hazlo más abajo y verás tu avance aquí.
      </Text>
    );
  // Sin porcentaje (el mes no tiene ingresos) no se mide nada: no se divide ni se inventa
  if (progreso.porcentajeAvance === null)
    return (
      <Text variant="muted">
        Todavía no hay ingresos este mes para medir tu meta. Cuando registres uno, verás tu avance.
      </Text>
    );
  return <Avance progreso={progreso} porcentaje={progreso.porcentajeAvance} />;
}

type Props = {
  /** YYYY-MM */
  mes: string;
  cargando: boolean;
  progreso: ProgresoAhorro | null;
  error: string | null;
  onReintentar: () => void;
};

/** Tarjeta de progreso del ahorro del mes (RF-22): las cifras las calcula el backend, aquí solo se presentan. */
export function TarjetaProgresoAhorro({ mes, cargando, progreso, error, onReintentar }: Props) {
  if (cargando)
    return (
      <View className="items-center rounded-xl border border-border bg-card p-4 py-10">
        <ActivityIndicator accessibilityLabel="Cargando tu progreso de ahorro" />
      </View>
    );

  if (error || !progreso)
    return (
      <View className="items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Text variant="muted" role="alert" className="text-center">
          {error}
        </Text>
        <Button
          variant="outline"
          accessibilityRole="button"
          accessibilityLabel="Reintentar progreso de ahorro"
          onPress={onReintentar}
        >
          <Text>Reintentar</Text>
        </Button>
      </View>
    );

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text variant="large">{mesConAnio(mes)}</Text>
      <View>
        <Text variant="muted">Ahorro de este mes</Text>
        <Text className="text-xl font-bold">{pesosConSigno(progreso.ahorroDelMes)}</Text>
      </View>
      <Detalle progreso={progreso} />
    </View>
  );
}
