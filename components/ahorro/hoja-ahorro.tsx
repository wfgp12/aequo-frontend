import { CampoMonto } from '@/components/campo-monto';
import { DialogoEliminar } from '@/components/tarjetas/dialogo-eliminar';
import { Campo, ESTILO_CAMPO, HojaFormulario } from '@/components/tarjetas/hoja-formulario';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { guardarAhorroReal, obtenerMetaDelMes } from '@/lib/api/ahorro';
import { ApiError } from '@/lib/api/client';
import { esCaso, mensajeAlCambiar } from '@/lib/errores';
import { mesEnLetras } from '@/lib/fechas';
import { useGuardarHoja } from '@/lib/use-guardar-hoja';
import { useState } from 'react';

/**
 * Guarda lo anotado en la meta de ese mes. El acumulado no trae el id de la meta, así que se consulta al guardar;
 * si el mes ya no tiene meta se trata igual que el 404 del backend.
 */
async function anotar(periodo: string, ahorroReal: number) {
  const meta = await obtenerMetaDelMes(periodo);
  if (!meta) throw new ApiError(404, 'Meta de ahorro no encontrada');
  await guardarAhorroReal(meta.id, ahorroReal);
}

const mensajeAlGuardar = (e: unknown) =>
  esCaso(e, 404, 'META_NO_ENCONTRADA')
    ? 'Ese mes ya no tiene meta, así que no se puede anotar el ahorro.'
    : mensajeAlCambiar(e, 'No pudimos guardar tu ahorro. Inténtalo de nuevo en unos minutos.');

const mensajeAlBorrar = (e: unknown) =>
  mensajeAlCambiar(e, 'No pudimos borrar lo anotado. Inténtalo de nuevo en unos minutos.');

type Props = {
  /** YYYY-MM */
  periodo: string;
  /** Lo que está anotado en ese mes (0 si no hay nada). */
  ahorroReal: number;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se anotó, se borró o el mes ya no tiene meta). */
  onCambio: () => void;
};

/** Hoja "Ahorro de <mes>": escribir cuánto se pudo ahorrar ese mes o borrar lo anotado (con confirmación). */
export function HojaAhorro({ periodo, ahorroReal, onCerrar, onCambio }: Props) {
  const guardado = Math.round(ahorroReal);
  // El campo solo escribe pesos positivos: un negativo guardado por otro medio empieza vacío
  const [valor, setValor] = useState(guardado > 0 ? String(guardado) : '');
  const [confirmando, setConfirmando] = useState(false);
  const mes = mesEnLetras(periodo);

  const { aviso, guardando, limpiarAviso, guardar } = useGuardarHoja<{ ahorroReal: number }>({
    leer: () =>
      valor ? { datos: { ahorroReal: Number(valor) } } : { error: 'Escribe cuánto ahorraste.' },
    edicion: {
      cambios: (datos) => (datos.ahorroReal === guardado ? {} : datos),
      enviar: () => anotar(periodo, Number(valor)),
    },
    // La meta del mes ya existe: aquí siempre se edita, nunca se crea
    crear: async () => {},
    mensajeDeError: mensajeAlGuardar,
    onCambio,
    onCerrar,
  });

  return (
    <>
      <HojaFormulario
        titulo={`Ahorro de ${mes}`}
        onCerrar={onCerrar}
        aviso={aviso}
        guardando={guardando}
        textoGuardar="Guardar ahorro"
        onGuardar={() => {
          void guardar();
        }}
        acciones={
          ahorroReal !== 0 ? (
            <Button
              variant="outline"
              className="mt-3 h-[50px] w-full"
              disabled={guardando}
              onPress={() => setConfirmando(true)}
            >
              <Text className="font-semibold text-destructive">Borrar lo anotado</Text>
            </Button>
          ) : null
        }
      >
        <Campo etiqueta="¿Cuánto pudiste ahorrar?">
          <CampoMonto
            valor={valor}
            onCambiar={(digitos) => {
              setValor(digitos);
              limpiarAviso();
            }}
            className={ESTILO_CAMPO}
          />
        </Campo>
        <Text variant="muted" className="mt-2 text-xs">
          Es lo que de verdad lograste guardar ese mes. Lo escribes tú.
        </Text>
      </HojaFormulario>

      {confirmando ? (
        <DialogoEliminar
          titulo="¿Borrar lo anotado?"
          detalle={`Se borrará el ahorro anotado de ${mes}. La meta de ese mes no cambia.`}
          eliminar={() => anotar(periodo, 0)}
          mensajeDeError={mensajeAlBorrar}
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
