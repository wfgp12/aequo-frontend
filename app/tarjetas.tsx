import { HojaTarjeta } from '@/components/tarjetas/hoja-tarjeta';
import {
  BotonAgregar,
  FilaDeLista,
  PantallaDeLista,
} from '@/components/tarjetas/pantalla-de-lista';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { textoDeTasa } from '@/lib/tarjetas';
import { useTarjetas } from '@/lib/use-tarjetas';
import { useRouter } from 'expo-router';
import { useState } from 'react';

/**
 * "Mis tarjetas" (wireframe de Figma, sin los datos que la API no tiene todavía: cupo, corte, pago y deuda):
 * crea tarjetas y lleva al detalle de cada una (donde se edita, se elimina y se ven sus pagos) y al avance en
 * efectivo. Solo presenta lo que responde el backend, en el orden que él manda.
 */
export default function Tarjetas() {
  const router = useRouter();
  // Al volver de un detalle (donde pudo cambiar o eliminarse una tarjeta) la lista se pide de nuevo
  const { cargando, items, fallo, recargar } = useTarjetas(true);
  const [creando, setCreando] = useState(false);

  return (
    <PantallaDeLista
      titulo="Mis tarjetas"
      etiquetaDeCarga="Cargando tus tarjetas"
      cargando={cargando}
      fallo={fallo}
      onReintentar={recargar}
      hoja={
        creando ? (
          <HojaTarjeta tarjeta={null} onCerrar={() => setCreando(false)} onCambio={recargar} />
        ) : null
      }
    >
      {items.length === 0 ? (
        <Text variant="muted" className="py-4 text-center">
          Todavía no tienes tarjetas. Agrega la primera para empezar.
        </Text>
      ) : (
        items.map((tarjeta) => (
          <FilaDeLista
            key={tarjeta.id}
            titulo={tarjeta.nombre}
            detalle={textoDeTasa(tarjeta.tasaEA)}
            onPress={() =>
              router.push({
                pathname: '/tarjetas/[id]',
                params: { id: tarjeta.id, nombre: tarjeta.nombre },
              })
            }
          />
        ))
      )}
      <BotonAgregar texto="+ Agregar tarjeta" onPress={() => setCreando(true)} />
      {items.length > 0 ? (
        <Button
          variant="outline"
          className="min-h-14"
          onPress={() => router.push('/avance-en-efectivo')}
        >
          <Text className="font-semibold">Avance en efectivo</Text>
        </Button>
      ) : null}
    </PantallaDeLista>
  );
}
