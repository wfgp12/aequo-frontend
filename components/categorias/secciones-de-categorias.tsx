import { BotonAgregar, FilaDeLista } from '@/components/tarjetas/pantalla-de-lista';
import { Text } from '@/components/ui/text';
import type { Categoria, TipoMovimiento } from '@/lib/api/categorias';
import { textoDeMovimientos } from '@/lib/categorias';
import { View } from 'react-native';

type Props = {
  tipo: TipoMovimiento;
  categorias: Categoria[];
  /** Solo las propias se pueden tocar. */
  onEditar: (categoria: Categoria) => void;
  onNueva: () => void;
};

const Titulo = ({ children }: { children: string }) => (
  <Text variant="muted" role="heading" className="mt-2 text-xs font-semibold">
    {children}
  </Text>
);

/** "TUS CATEGORÍAS" (tocables) y "GENERALES" (de Aequo, solo lectura), en el orden que manda el backend. */
export function SeccionesDeCategorias({ tipo, categorias, onEditar, onNueva }: Props) {
  const propias = categorias.filter((c) => !c.esPredeterminada);

  return (
    <>
      <Titulo>TUS CATEGORÍAS</Titulo>
      {propias.length === 0 ? (
        <Text variant="muted" className="py-4 text-center">
          Todavía no tienes categorías propias.
        </Text>
      ) : (
        propias.map((c) => (
          <FilaDeLista
            key={c.id}
            titulo={c.nombre}
            detalle={textoDeMovimientos(c.movimientos)}
            conFlecha
            onPress={() => onEditar(c)}
          />
        ))
      )}
      <BotonAgregar
        texto={`+ Nueva categoría de ${tipo === 'INGRESO' ? 'ingreso' : 'egreso'}`}
        onPress={onNueva}
      />

      <Titulo>GENERALES</Titulo>
      {categorias
        .filter((c) => c.esPredeterminada)
        .map((c) => (
          <View
            key={c.id}
            className="min-h-14 justify-center rounded-xl border border-border bg-card px-4 py-2"
          >
            <Text>{c.nombre}</Text>
          </View>
        ))}
      <Text variant="muted" className="text-center text-xs">
        Las categorías generales son de Aequo y no se pueden editar.
      </Text>
    </>
  );
}
