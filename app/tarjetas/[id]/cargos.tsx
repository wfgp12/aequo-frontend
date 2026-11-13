import { HojaCargo } from '@/components/tarjetas/hoja-cargo';
import {
  BotonAgregar,
  FilaDeLista,
  PantallaDeLista,
} from '@/components/tarjetas/pantalla-de-lista';
import { Text } from '@/components/ui/text';
import type { CargoFijo } from '@/lib/api/tarjetas';
import { textoAlMes } from '@/lib/tarjetas';
import { useCargos } from '@/lib/use-tarjetas';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

/** Una sección de la lista ("ACTIVOS ESTE MES"): no se pinta si no tiene cargos. */
function Seccion({
  titulo,
  cargos,
  onElegir,
}: {
  titulo: string;
  cargos: CargoFijo[];
  onElegir: (cargo: CargoFijo) => void;
}) {
  if (cargos.length === 0) return null;
  return (
    <>
      <Text variant="muted" className="mt-2 text-xs font-semibold">
        {titulo}
      </Text>
      {cargos.map((cargo) => (
        <FilaDeLista
          key={cargo.id}
          titulo={cargo.descripcion}
          detalle={textoAlMes(cargo.valor)}
          onPress={() => onElegir(cargo)}
        />
      ))}
    </>
  );
}

/**
 * Cargos fijos de una tarjeta (wireframe "Cargos fijos de tarjeta" de Figma): lo que la tarjeta cobra cada mes,
 * separado en activos e inactivos. El nombre de la tarjeta llega como parámetro de la ruta.
 */
export default function CargosFijos() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const { cargando, items, fallo, recargar } = useCargos(id);
  // 'nuevo' abre el formulario vacío; un cargo, el de editarlo
  const [hoja, setHoja] = useState<CargoFijo | 'nuevo' | null>(null);

  return (
    <PantallaDeLista
      titulo={nombre || 'Cargos fijos'}
      subtitulo={nombre ? 'Cargos fijos' : undefined}
      etiquetaDeCarga="Cargando tus cargos fijos"
      cargando={cargando}
      fallo={fallo}
      onReintentar={recargar}
      hoja={
        hoja ? (
          <HojaCargo
            key={hoja === 'nuevo' ? 'nuevo' : hoja.id}
            tarjetaId={id}
            cargo={hoja === 'nuevo' ? null : hoja}
            onCerrar={() => setHoja(null)}
            onCambio={recargar}
          />
        ) : null
      }
    >
      {items.length === 0 ? (
        <Text variant="muted" className="py-4 text-center">
          Esta tarjeta no tiene cargos fijos. Agrega los que te cobran cada mes, como una
          suscripción.
        </Text>
      ) : (
        <>
          <Seccion
            titulo="ACTIVOS ESTE MES"
            cargos={items.filter((c) => c.activo)}
            onElegir={setHoja}
          />
          <Seccion titulo="INACTIVOS" cargos={items.filter((c) => !c.activo)} onElegir={setHoja} />
        </>
      )}
      <BotonAgregar texto="+ Agregar cargo fijo" onPress={() => setHoja('nuevo')} />
    </PantallaDeLista>
  );
}
