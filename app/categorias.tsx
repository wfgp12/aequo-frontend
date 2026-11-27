import { HojaEditarCategoria } from '@/components/categorias/hoja-editar-categoria';
import { HojaNuevaCategoria } from '@/components/categorias/hoja-nueva-categoria';
import { SeccionesDeCategorias } from '@/components/categorias/secciones-de-categorias';
import { SelectorDePildoras } from '@/components/selector-de-pildoras';
import { PantallaDeLista } from '@/components/tarjetas/pantalla-de-lista';
import type { Categoria, TipoMovimiento } from '@/lib/api/categorias';
import { useCategorias } from '@/lib/use-categorias';
import { useState } from 'react';

const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: 'EGRESO', etiqueta: 'Egresos' },
  { valor: 'INGRESO', etiqueta: 'Ingresos' },
];

/**
 * "Mis categorías" (wireframe de Figma, sección 04): ve las categorías propias y las generales por tipo, y crea,
 * renombra o elimina las propias. Tras cada cambio se pide la lista otra vez: el orden y los conteos son del servidor.
 */
export default function Categorias() {
  const [tipo, setTipo] = useState<TipoMovimiento>('EGRESO');
  const { cargando, dato, fallo, recargar } = useCategorias(tipo);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);

  return (
    <PantallaDeLista
      titulo="Mis categorías"
      encabezado={<SelectorDePildoras opciones={TIPOS} valor={tipo} onElegir={setTipo} />}
      etiquetaDeCarga="Cargando tus categorías"
      cargando={cargando}
      fallo={fallo}
      onReintentar={recargar}
      hoja={
        creando ? (
          <HojaNuevaCategoria
            tipo={tipo}
            onCerrar={() => setCreando(false)}
            onCreada={() => {
              setCreando(false);
              recargar();
            }}
          />
        ) : editando ? (
          <HojaEditarCategoria
            categoria={editando}
            onCerrar={() => setEditando(null)}
            onCambio={recargar}
          />
        ) : null
      }
    >
      <SeccionesDeCategorias
        tipo={tipo}
        categorias={dato ?? []}
        onEditar={setEditando}
        onNueva={() => setCreando(true)}
      />
    </PantallaDeLista>
  );
}
