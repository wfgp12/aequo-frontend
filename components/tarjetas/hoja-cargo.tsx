import { CampoMonto } from '@/components/campo-monto';
import { DialogoEliminar } from '@/components/tarjetas/dialogo-eliminar';
import {
  Campo,
  CampoInterruptor,
  CampoTexto,
  ESTILO_CAMPO,
  HojaFormulario,
} from '@/components/tarjetas/hoja-formulario';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  actualizarCargo,
  crearCargo,
  eliminarCargo,
  type CargoFijo,
  type DatosCargo,
} from '@/lib/api/tarjetas';
import {
  camposDeCargo,
  leerCargo,
  mensajeAlEliminarCargo,
  mensajeAlGuardarCargo,
  soloLoCambiado,
  textoAlMes,
} from '@/lib/tarjetas';
import { useGuardarHoja } from '@/lib/use-guardar-hoja';
import { useState } from 'react';

type Props = {
  tarjetaId: string;
  /** El cargo que se edita, o null para uno nuevo. */
  cargo: CargoFijo | null;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se guardó, se eliminó o ya no existe): la lista debe volver a cargarse. */
  onCambio: () => void;
};

/**
 * Hoja "Nuevo cargo fijo" / "Editar cargo fijo": descripción, valor al mes y si está activo este mes (así se activa
 * o desactiva un cargo). Al editar envía solo lo que cambió y suma "Eliminar cargo fijo".
 */
export function HojaCargo({ tarjetaId, cargo, onCerrar, onCambio }: Props) {
  const inicial = camposDeCargo(cargo);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [valor, setValor] = useState(inicial.valor);
  const [activo, setActivo] = useState(inicial.activo);
  const [confirmando, setConfirmando] = useState(false);

  const { aviso, guardando, limpiarAviso, guardar } = useGuardarHoja<DatosCargo>({
    leer: () => leerCargo(descripcion, valor, activo),
    edicion: cargo && {
      cambios: (datos) => soloLoCambiado<DatosCargo>(cargo, datos),
      enviar: (cambios) => actualizarCargo(tarjetaId, cargo.id, cambios),
    },
    crear: (datos, clave) => crearCargo(tarjetaId, datos, clave),
    mensajeDeError: mensajeAlGuardarCargo,
    onCambio,
    onCerrar,
  });

  // Cualquier cambio en el formulario deja de mostrar el aviso anterior
  const cambiar =
    <T,>(poner: (valor: T) => void) =>
    (nuevo: T) => {
      poner(nuevo);
      limpiarAviso();
    };

  return (
    <>
      <HojaFormulario
        titulo={cargo ? 'Editar cargo fijo' : 'Nuevo cargo fijo'}
        onCerrar={onCerrar}
        aviso={aviso}
        guardando={guardando}
        textoGuardar="Guardar cargo fijo"
        onGuardar={() => {
          void guardar();
        }}
        acciones={
          cargo ? (
            <Button
              variant="outline"
              className="mt-3 h-[50px] w-full"
              disabled={guardando}
              onPress={() => setConfirmando(true)}
            >
              <Text className="font-semibold text-destructive">Eliminar cargo fijo</Text>
            </Button>
          ) : null
        }
      >
        <CampoTexto
          etiqueta="Descripción"
          valor={descripcion}
          onCambiar={cambiar(setDescripcion)}
          placeholder="Ej: Netflix"
        />
        <Campo etiqueta="Valor al mes">
          <CampoMonto valor={valor} onCambiar={cambiar(setValor)} className={ESTILO_CAMPO} />
        </Campo>
        <CampoInterruptor
          etiqueta="Activo este mes"
          valor={activo}
          onCambiar={cambiar(setActivo)}
        />
      </HojaFormulario>

      {cargo && confirmando ? (
        <DialogoEliminar
          titulo="¿Eliminar este cargo fijo?"
          detalle={`${cargo.descripcion} · ${textoAlMes(cargo.valor)}. Esta acción no se puede deshacer.`}
          eliminar={() => eliminarCargo(tarjetaId, cargo.id)}
          mensajeDeError={mensajeAlEliminarCargo}
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
