import { SelectorDeMes } from '@/components/selector-de-mes';
import { DetalleDelMes } from '@/components/tarjetas/detalle-del-mes';
import { HojaTarjeta } from '@/components/tarjetas/hoja-tarjeta';
import { EstadoDeLista, MarcoDePantalla } from '@/components/tarjetas/pantalla-de-lista';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Tarjeta } from '@/lib/api/tarjetas';
import { encabezadoDeTarjeta } from '@/lib/tarjetas';
import { useDetalleTarjeta } from '@/lib/use-detalle-tarjeta';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

/** "Editar tarjeta" y "Ver cargos fijos": solo cuando ya se tienen los datos de la tarjeta. */
function AccionesDeLaTarjeta({
  tarjeta,
  onEditar,
}: {
  tarjeta: Tarjeta;
  onEditar: (tarjeta: Tarjeta) => void;
}) {
  const router = useRouter();
  return (
    <>
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
 * con su desglose, lo que le queda por pagar y los meses siguientes, con selector de mes. Desde aquí se edita la
 * tarjeta y se va a sus cargos fijos. El nombre llega como parámetro de la ruta para verse al instante.
 */
export default function DetalleDeTarjeta() {
  const router = useRouter();
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const { mes, cambiarMes, tarjeta, proyeccion, fallo, cargando, reintentar, recargarTarjeta } =
    useDetalleTarjeta(id);
  // La hoja guarda la tarjeta con que se abrió: sigue en pantalla aunque el detalle vuelva a pedirla
  const [editando, setEditando] = useState<Tarjeta | null>(null);
  // Reintentar no ayuda si la tarjeta ya no existe: no hay nada más que ver ni hacer
  const yaNoExiste = fallo !== null && !fallo.reintentar;

  return (
    <MarcoDePantalla
      {...encabezadoDeTarjeta(tarjeta, nombre)}
      hoja={
        editando ? (
          <HojaTarjeta
            key={editando.id}
            tarjeta={editando}
            onCerrar={() => setEditando(null)}
            onCambio={recargarTarjeta}
            onEliminada={() => router.back()}
          />
        ) : null
      }
    >
      {yaNoExiste ? null : <SelectorDeMes mes={mes} onCambiar={cambiarMes} />}

      <EstadoDeLista
        etiquetaDeCarga="Cargando tu tarjeta"
        cargando={cargando}
        fallo={fallo}
        onReintentar={reintentar}
      >
        {proyeccion ? <DetalleDelMes proyeccion={proyeccion} /> : null}
      </EstadoDeLista>

      {tarjeta && !yaNoExiste ? (
        <AccionesDeLaTarjeta tarjeta={tarjeta} onEditar={setEditando} />
      ) : null}
    </MarcoDePantalla>
  );
}
