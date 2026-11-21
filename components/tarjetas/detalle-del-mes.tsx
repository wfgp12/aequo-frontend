import { Text } from '@/components/ui/text';
import type { MesProyectado, ProyeccionTarjeta } from '@/lib/api/tarjetas';
import { formatearPesos } from '@/lib/dinero';
import { mesActual, mesEnLetras } from '@/lib/fechas';
import { NOTA_DE_LA_CUOTA } from '@/lib/tarjetas';
import type { ReactNode } from 'react';
import { View } from 'react-native';

// Lo que el backend calcula para una tarjeta en un mes (RF-30 y RF-31). Todo viene hecho: aquí solo se redondea al
// peso al mostrar, sin sumar ni restar nada (RNF-11).

const NOTA_DEL_SALDO =
  'Suma las cuotas que faltan, con sus intereses. No incluye los cargos fijos.';
const SIN_PAGOS =
  'No tienes pagos pendientes con esta tarjeta. Cuando registres compras a cuotas o cargos fijos, los verás aquí.';

const pesos = (valor: number) => `$ ${formatearPesos(valor)}`;

/** Un rótulo con su cifra, que el lector de pantalla lee juntos ("Este mes pagas, $ 346.270"). */
function Cifra({
  rotulo,
  valor,
  grande,
  children,
}: {
  rotulo: string;
  valor: number;
  grande?: boolean;
  children?: ReactNode;
}) {
  return (
    <View className="gap-1 rounded-xl border border-border bg-card p-4">
      <View accessible accessibilityLabel={`${rotulo}, ${pesos(valor)}`}>
        <Text variant="muted">{rotulo}</Text>
        <Text className={grande ? 'text-3xl font-bold' : 'text-2xl font-bold'}>{pesos(valor)}</Text>
      </View>
      {children}
    </View>
  );
}

function FilaDeMes({ mes }: { mes: MesProyectado }) {
  const nombre = mesEnLetras(mes.mes);
  return (
    <View
      accessible
      accessibilityLabel={`${nombre}, total ${pesos(mes.total)}`}
      className="min-h-14 justify-center rounded-xl border border-border bg-card px-4 py-2"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold">{nombre}</Text>
        <Text className="font-semibold">{pesos(mes.total)}</Text>
      </View>
      <Text variant="muted">{`Cuotas ${pesos(mes.cuotas)} · Cargos fijos ${pesos(mes.cargosFijos)}`}</Text>
    </View>
  );
}

/**
 * Lo que se paga en el mes elegido, lo que queda por pagar después y los meses siguientes, tal como los entrega el
 * backend. Si no hay nada de eso (tarjeta nueva, mes lejano), un texto amable en vez de ceros y tablas vacías.
 */
export function DetalleDelMes({ proyeccion }: { proyeccion: ProyeccionTarjeta }) {
  // El mes elegido ya está arriba, en "Este mes pagas": nunca se repite como fila de "Próximos meses"
  const siguientes = proyeccion.proyeccion.filter((m) => m.mes !== proyeccion.mes);
  if (proyeccion.total === 0 && proyeccion.saldoPendiente === 0 && siguientes.length === 0) {
    return (
      <Text variant="muted" className="py-4 text-center">
        {SIN_PAGOS}
      </Text>
    );
  }

  const esteMes = proyeccion.mes === mesActual();
  const nombre = esteMes ? 'este mes' : mesEnLetras(proyeccion.mes);
  return (
    <>
      <Cifra
        rotulo={esteMes ? 'Este mes pagas' : `Pagas en ${nombre}`}
        valor={proyeccion.total}
        grande
      >
        <Text>{`Cuotas ${pesos(proyeccion.cuotas)}`}</Text>
        <Text>{`Cargos fijos ${pesos(proyeccion.cargosFijos)}`}</Text>
        <Text variant="muted" className="text-xs">
          {NOTA_DE_LA_CUOTA}
        </Text>
      </Cifra>

      <Cifra rotulo={`Te queda por pagar después de ${nombre}`} valor={proyeccion.saldoPendiente}>
        <Text variant="muted" className="text-xs">
          {NOTA_DEL_SALDO}
        </Text>
      </Cifra>

      {siguientes.length ? (
        <>
          <Text className="mt-2 text-lg font-semibold">Próximos meses</Text>
          {siguientes.map((mes) => (
            <FilaDeMes key={mes.mes} mes={mes} />
          ))}
        </>
      ) : null}
    </>
  );
}
