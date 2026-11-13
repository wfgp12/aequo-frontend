import { HojaTarjeta } from '@/components/tarjetas/hoja-tarjeta';
import {
  BotonAgregar,
  FilaDeLista,
  PantallaDeLista,
} from '@/components/tarjetas/pantalla-de-lista';
import { Text } from '@/components/ui/text';
import type { Tarjeta } from '@/lib/api/tarjetas';
import { textoDeTasa } from '@/lib/tarjetas';
import { useTarjetas } from '@/lib/use-tarjetas';
import { useState } from 'react';

/**
 * "Mis tarjetas" (wireframe de Figma, sin los datos que la API no tiene todavía: cupo, corte, pago y deuda):
 * crea, edita (también la tasa) y elimina tarjetas, y lleva a sus cargos fijos. Solo presenta lo que responde
 * el backend, en el orden que él manda.
 */
export default function Tarjetas() {
  const { cargando, items, fallo, recargar } = useTarjetas();
  // 'nueva' abre el formulario vacío; una tarjeta, el de editarla
  const [hoja, setHoja] = useState<Tarjeta | 'nueva' | null>(null);

  return (
    <PantallaDeLista
      titulo="Mis tarjetas"
      etiquetaDeCarga="Cargando tus tarjetas"
      cargando={cargando}
      fallo={fallo}
      onReintentar={recargar}
      hoja={
        hoja ? (
          <HojaTarjeta
            key={hoja === 'nueva' ? 'nueva' : hoja.id}
            tarjeta={hoja === 'nueva' ? null : hoja}
            onCerrar={() => setHoja(null)}
            onCambio={recargar}
          />
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
            onPress={() => setHoja(tarjeta)}
          />
        ))
      )}
      <BotonAgregar texto="+ Agregar tarjeta" onPress={() => setHoja('nueva')} />
    </PantallaDeLista>
  );
}
