import { HojaCategoria } from '@/components/categorias/hoja-categoria';
import { DialogoEliminar } from '@/components/tarjetas/dialogo-eliminar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { eliminarCategoria, renombrarCategoria, type Categoria } from '@/lib/api/categorias';
import {
  avisoAlEliminarCategoria,
  leerNombre,
  mensajeAlEliminarCategoria,
  mensajeAlGuardarCategoria,
} from '@/lib/categorias';
import { esCaso } from '@/lib/errores';
import { useGuardarHoja } from '@/lib/use-guardar-hoja';
import { useState } from 'react';

type Props = {
  categoria: Categoria;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se guardó, se eliminó o ya no existe): la lista debe volver a cargarse. */
  onCambio: () => void;
};

/** Hoja "Editar categoría" de una categoría propia: cambia el nombre o la elimina, con confirmación. */
export function HojaEditarCategoria({ categoria, onCerrar, onCambio }: Props) {
  const [nombre, setNombre] = useState(categoria.nombre);
  const [confirmando, setConfirmando] = useState(false);

  const { aviso, guardando, limpiarAviso, guardar } = useGuardarHoja<{ nombre: string }>({
    leer: () => leerNombre(nombre),
    edicion: {
      cambios: (datos) => (datos.nombre === categoria.nombre ? {} : datos),
      enviar: (cambios) => renombrarCategoria(categoria.id, cambios.nombre!),
    },
    // Esta hoja solo edita: para crear está "Nueva categoría"
    crear: () => Promise.resolve(),
    mensajeDeError: (e) =>
      esCaso(e, 404, 'CATEGORIA_NO_ENCONTRADA')
        ? 'Esta categoría ya no existe.'
        : mensajeAlGuardarCategoria(e),
    onCambio,
    onCerrar,
  });

  return (
    <>
      <HojaCategoria
        titulo="Editar categoría"
        tipo={categoria.tipo}
        nombre={nombre}
        onCambiarNombre={(t) => {
          setNombre(t);
          limpiarAviso();
        }}
        aviso={aviso}
        guardando={guardando}
        onGuardar={() => {
          void guardar();
        }}
        onCerrar={onCerrar}
      >
        <Button
          variant="outline"
          className="mt-3 h-[50px] w-full"
          disabled={guardando}
          onPress={() => setConfirmando(true)}
        >
          <Text className="font-semibold text-destructive">Eliminar categoría</Text>
        </Button>
      </HojaCategoria>

      {confirmando ? (
        <DialogoEliminar
          titulo={`¿Eliminar "${categoria.nombre}"?`}
          detalle={avisoAlEliminarCategoria(categoria.tipo, categoria.movimientos)}
          eliminar={() => eliminarCategoria(categoria.id)}
          mensajeDeError={mensajeAlEliminarCategoria}
          onCancelar={() => setConfirmando(false)}
          onEliminado={() => {
            onCambio();
            onCerrar();
          }}
        />
      ) : null}
    </>
  );
}
