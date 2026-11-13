import { normalizarPorcentaje } from '@/components/ahorro/campo-porcentaje';
import { DialogoEliminar } from '@/components/tarjetas/dialogo-eliminar';
import {
  CampoInterruptor,
  CampoTexto,
  HojaFormulario,
} from '@/components/tarjetas/hoja-formulario';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  actualizarTarjeta,
  crearTarjeta,
  eliminarTarjeta,
  type DatosTarjeta,
  type Tarjeta,
} from '@/lib/api/tarjetas';
import {
  camposDeTarjeta,
  leerTarjeta,
  mensajeAlEliminarTarjeta,
  mensajeAlGuardarTarjeta,
  soloLoCambiado,
} from '@/lib/tarjetas';
import { useGuardarHoja } from '@/lib/use-guardar-hoja';
import { useRouter } from 'expo-router';
import { useState } from 'react';

type Props = {
  /** La tarjeta que se edita, o null para una nueva. */
  tarjeta: Tarjeta | null;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se guardó, se eliminó o ya no existe): la lista debe volver a cargarse. */
  onCambio: () => void;
};

/**
 * Hoja "Nueva tarjeta" / "Editar tarjeta": alias, tasa de interés y si las compras a 1 cuota van sin intereses.
 * Al editar envía solo lo que cambió (así se cambia la tasa) y suma "Cargos fijos" y "Eliminar tarjeta".
 */
export function HojaTarjeta({ tarjeta, onCerrar, onCambio }: Props) {
  const router = useRouter();
  const inicial = camposDeTarjeta(tarjeta);
  const [alias, setAlias] = useState(inicial.alias);
  const [tasa, setTasa] = useState(inicial.tasa);
  const [cuotaUnica, setCuotaUnica] = useState(inicial.cuotaUnica);
  const [confirmando, setConfirmando] = useState(false);

  const { aviso, guardando, limpiarAviso, guardar } = useGuardarHoja<DatosTarjeta>({
    leer: () => leerTarjeta(alias, tasa, cuotaUnica),
    edicion: tarjeta && {
      cambios: (datos) => soloLoCambiado<DatosTarjeta>(tarjeta, datos),
      enviar: (cambios) => actualizarTarjeta(tarjeta.id, cambios),
    },
    crear: crearTarjeta,
    mensajeDeError: mensajeAlGuardarTarjeta,
    onCambio,
    onCerrar,
  });

  // Cualquier cambio en el formulario deja de mostrar el aviso anterior
  const cambiar =
    <T,>(poner: (valor: T) => void) =>
    (valor: T) => {
      poner(valor);
      limpiarAviso();
    };

  function irACargos(t: Tarjeta) {
    onCerrar();
    router.push({ pathname: '/tarjetas/[id]/cargos', params: { id: t.id, nombre: t.nombre } });
  }

  return (
    <>
      <HojaFormulario
        titulo={tarjeta ? 'Editar tarjeta' : 'Nueva tarjeta'}
        onCerrar={onCerrar}
        aviso={aviso}
        guardando={guardando}
        textoGuardar="Guardar tarjeta"
        onGuardar={() => {
          void guardar();
        }}
        acciones={
          tarjeta ? (
            <>
              <Button
                variant="outline"
                className="mt-3 h-[50px] w-full"
                disabled={guardando}
                onPress={() => irACargos(tarjeta)}
              >
                <Text className="font-semibold">Cargos fijos</Text>
              </Button>
              <Button
                variant="outline"
                className="mt-3 h-[50px] w-full"
                disabled={guardando}
                onPress={() => setConfirmando(true)}
              >
                <Text className="font-semibold text-destructive">Eliminar tarjeta</Text>
              </Button>
            </>
          ) : null
        }
      >
        <CampoTexto
          etiqueta="Alias"
          valor={alias}
          onCambiar={cambiar(setAlias)}
          placeholder="Ej: Visa Bancolombia"
        />
        <CampoTexto
          etiqueta="Tasa de interés E.A."
          valor={tasa}
          onCambiar={(texto) => cambiar(setTasa)(normalizarPorcentaje(texto))}
          placeholder="Ej: 24%"
          keyboardType="decimal-pad"
        />
        {tarjeta ? (
          <Text variant="muted" className="mt-2 text-xs">
            Si cambias la tasa, aplica solo a las compras nuevas. Las anteriores conservan la que
            tenían.
          </Text>
        ) : null}
        <CampoInterruptor
          etiqueta="Compras a 1 cuota sin intereses"
          valor={cuotaUnica}
          onCambiar={cambiar(setCuotaUnica)}
        />
      </HojaFormulario>

      {tarjeta && confirmando ? (
        <DialogoEliminar
          titulo="¿Eliminar esta tarjeta?"
          detalle={`${tarjeta.nombre}. Se eliminarán también sus cargos fijos. Esta acción no se puede deshacer.`}
          eliminar={() => eliminarTarjeta(tarjeta.id)}
          mensajeDeError={mensajeAlEliminarTarjeta}
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
