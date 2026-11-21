import { SelectorDeMes } from '@/components/selector-de-mes';
import { DetalleDelMes } from '@/components/tarjetas/detalle-del-mes';
import { HojaPago } from '@/components/tarjetas/hoja-pago';
import { HojaTarjeta } from '@/components/tarjetas/hoja-tarjeta';
import { PagosDelMes } from '@/components/tarjetas/pagos-del-mes';
import { EstadoDeLista, MarcoDePantalla } from '@/components/tarjetas/pantalla-de-lista';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Tarjeta } from '@/lib/api/tarjetas';
import { encabezadoDeTarjeta, valorSugeridoDelPago } from '@/lib/tarjetas';
import { useDetalleTarjeta } from '@/lib/use-detalle-tarjeta';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

/** "Registrar un pago", "Editar tarjeta" y "Ver cargos fijos": solo cuando ya se tienen los datos de la tarjeta. */
function AccionesDeLaTarjeta({
  tarjeta,
  onPagar,
  onEditar,
}: {
  tarjeta: Tarjeta;
  onPagar: (tarjeta: Tarjeta) => void;
  onEditar: (tarjeta: Tarjeta) => void;
}) {
  const router = useRouter();
  return (
    <>
      <Button className="min-h-14" onPress={() => onPagar(tarjeta)}>
        <Text className="font-semibold">Registrar un pago</Text>
      </Button>
      <Button variant="outline" className="min-h-14" onPress={() => onEditar(tarjeta)}>
        <Text className="font-semibold">Editar tarjeta</Text>
      </Button>
      <Button
        variant="outline"
        className="min-h-14"
        onPress={() =>
          router.push({
            pathname: '/tarjetas/[id]/cargos',
            params: { id: tarjeta.id, nombre: tarjeta.nombre },
          })
        }
      >
        <Text className="font-semibold">Ver cargos fijos</Text>
      </Button>
    </>
  );
}

/**
 * Detalle de una tarjeta (wireframe "Detalle de tarjeta" de Figma, solo con lo que da la API): lo que paga este mes
 * con su desglose, lo que ya pagó (con la lista de sus pagos), lo que le queda por pagar y los meses siguientes, con
 * selector de mes. Desde aquí se registra un pago, se edita la tarjeta y se va a sus cargos fijos. El nombre llega
 * como parámetro de la ruta para verse al instante.
 */
export default function DetalleDeTarjeta() {
  const router = useRouter();
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const {
    mes,
    cambiarMes,
    tarjeta,
    proyeccion,
    pagos,
    fallo,
    cargando,
    reintentar,
    recargarTarjeta,
    recargarMes,
  } = useDetalleTarjeta(id);
  // Las hojas guardan la tarjeta con que se abrieron: siguen en pantalla aunque el detalle vuelva a pedirla
  const [editando, setEditando] = useState<Tarjeta | null>(null);
  // El valor con que empieza la hoja se toma al abrirla: no cambia si las cifras se vuelven a pedir con ella abierta
  const [pagando, setPagando] = useState<{ tarjeta: Tarjeta; valorInicial: string } | null>(null);
  // Reintentar no ayuda si la tarjeta ya no existe: no hay nada más que ver ni hacer
  const yaNoExiste = fallo !== null && !fallo.reintentar;

  return (
    <MarcoDePantalla
      {...encabezadoDeTarjeta(tarjeta, nombre)}
      hoja={
        <>
          {editando ? (
            <HojaTarjeta
              key={editando.id}
              tarjeta={editando}
              onCerrar={() => setEditando(null)}
              onCambio={recargarTarjeta}
              onEliminada={() => router.back()}
            />
          ) : null}
          {pagando ? (
            <HojaPago
              tarjeta={pagando.tarjeta}
              valorInicial={pagando.valorInicial}
              onCerrar={() => setPagando(null)}
              onCambio={recargarMes}
            />
          ) : null}
        </>
      }
    >
      {yaNoExiste ? null : <SelectorDeMes mes={mes} onCambiar={cambiarMes} />}

      <EstadoDeLista
        etiquetaDeCarga="Cargando tu tarjeta"
        cargando={cargando}
        fallo={fallo}
        onReintentar={reintentar}
      >
        {proyeccion && pagos ? (
          <DetalleDelMes
            proyeccion={proyeccion}
            pagos={<PagosDelMes tarjetaId={id} mes={mes} pagos={pagos} onCambio={recargarMes} />}
          />
        ) : null}
      </EstadoDeLista>

      {tarjeta && !yaNoExiste ? (
        <AccionesDeLaTarjeta
          tarjeta={tarjeta}
          onPagar={(t) =>
            setPagando({ tarjeta: t, valorInicial: valorSugeridoDelPago(proyeccion) })
          }
          onEditar={setEditando}
        />
      ) : null}
    </MarcoDePantalla>
  );
}
