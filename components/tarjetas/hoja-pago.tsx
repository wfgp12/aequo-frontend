import { CampoMonto } from '@/components/campo-monto';
import { Confirmacion } from '@/components/registro/confirmacion';
import { SelectorDeFecha } from '@/components/selector-de-fecha';
import { SelectorDePildoras } from '@/components/selector-de-pildoras';
import {
  Campo,
  CampoTexto,
  ESTILO_CAMPO,
  HojaFormulario,
  MarcoDeHoja,
} from '@/components/tarjetas/hoja-formulario';
import { Text } from '@/components/ui/text';
import { registrarPago, type PagoRegistrado, type Tarjeta } from '@/lib/api/tarjetas';
import { MAX_DESCRIPCION, type MetodoPago } from '@/lib/api/transacciones';
import { formatearPesos } from '@/lib/dinero';
import { esApi } from '@/lib/errores';
import { hoy, mesEnLetras } from '@/lib/fechas';
import { METODOS_SIN_CREDITO } from '@/lib/metodos-de-pago';
import { leerPago, mensajeAlGuardarPago, textoDeDiferencia } from '@/lib/tarjetas';
import { useGuardarRegistro } from '@/lib/use-guardar-registro';
import { useState } from 'react';
import { View } from 'react-native';

type Props = {
  tarjeta: Tarjeta;
  /** El valor con que empieza la hoja, en pesos enteros (solo dígitos); vacío si no hay uno que sugerir. */
  valorInicial: string;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se registró el pago o se descubrió que la tarjeta ya no existe). */
  onCambio: () => void;
};

/** Lo que se pagó y lo que se debía en el mes del pago, tal como lo calculó el backend. */
function ConfirmacionDelPago({
  pago,
  tarjeta,
  onCerrar,
}: {
  pago: PagoRegistrado;
  tarjeta: Tarjeta;
  onCerrar: () => void;
}) {
  const { mes, estimado, pagado, diferencia } = pago.comparacion;
  // El pago puede ser de otro mes que el del detalle: el mes siempre se nombra
  return (
    <MarcoDeHoja titulo="Nuevo pago" onCerrar={onCerrar}>
      <View className="py-6">
        <Confirmacion
          mensaje={`Registramos tu pago de $ ${formatearPesos(pago.valor)} a ${tarjeta.nombre}.`}
          onCerrar={onCerrar}
        >
          <Text>{`Estimado de ${mesEnLetras(mes)}: $ ${formatearPesos(estimado)}`}</Text>
          <Text>{`Pagado en ${mesEnLetras(mes)}: $ ${formatearPesos(pagado)}`}</Text>
          <Text className="font-semibold">{textoDeDiferencia(diferencia)}</Text>
        </Confirmacion>
      </View>
    </MarcoDeHoja>
  );
}

/**
 * Hoja "Nuevo pago": valor, fecha, cómo se pagó y una nota opcional. Al guardar muestra la confirmación con lo pagado
 * frente a lo estimado del mes del pago; al cerrarla, el detalle vuelve a pedir sus cifras y su lista.
 */
export function HojaPago({ tarjeta, valorInicial, onCerrar, onCambio }: Props) {
  const [valor, setValor] = useState(valorInicial);
  const [fecha, setFecha] = useState(hoy);
  const [metodo, setMetodo] = useState<MetodoPago>('TRANSFERENCIA');
  const [nota, setNota] = useState('');
  const { guardando, error, guardado, guardar, avisar } = useGuardarRegistro<PagoRegistrado>();

  // Cualquier cambio en el formulario deja de mostrar el aviso anterior
  const cambiar =
    <T,>(poner: (valor: T) => void) =>
    (nuevo: T) => {
      poner(nuevo);
      avisar(null);
    };

  function enviar() {
    const lectura = leerPago(valor, fecha, metodo, nota);
    if ('error' in lectura) return avisar(lectura.error);
    const { datos } = lectura;
    return guardar(
      datos,
      (clave) =>
        registrarPago(tarjeta.id, datos, clave).catch((e: unknown) => {
          // Si la tarjeta ya no existe, el detalle debe dejar de mostrarla aunque la hoja siga abierta con el aviso
          if (esApi(e, 404)) onCambio();
          throw e;
        }),
      mensajeAlGuardarPago,
    );
  }

  if (guardado) {
    return (
      <ConfirmacionDelPago
        pago={guardado}
        tarjeta={tarjeta}
        onCerrar={() => {
          onCambio();
          onCerrar();
        }}
      />
    );
  }

  return (
    <HojaFormulario
      titulo="Nuevo pago"
      onCerrar={onCerrar}
      aviso={error}
      guardando={guardando}
      textoGuardar="Guardar pago"
      onGuardar={() => {
        void enviar();
      }}
    >
      <Campo etiqueta="Valor del pago">
        <CampoMonto valor={valor} onCambiar={cambiar(setValor)} className={ESTILO_CAMPO} />
      </Campo>
      <Campo etiqueta="Fecha del pago">
        <SelectorDeFecha fecha={fecha} onCambiar={cambiar(setFecha)} />
      </Campo>
      <Campo etiqueta="Cómo pagaste">
        <SelectorDePildoras
          opciones={METODOS_SIN_CREDITO}
          valor={metodo}
          onElegir={cambiar(setMetodo)}
        />
      </Campo>
      <CampoTexto
        etiqueta="Nota (opcional)"
        nombre="Nota"
        valor={nota}
        onCambiar={(texto) => cambiar(setNota)(texto.slice(0, MAX_DESCRIPCION))}
        maxLength={MAX_DESCRIPCION}
      />
    </HojaFormulario>
  );
}
