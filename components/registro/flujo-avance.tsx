import { Confirmacion } from '@/components/registro/confirmacion';
import { EncabezadoRegistro } from '@/components/registro/encabezado';
import { PasoCuotas } from '@/components/registro/paso-cuotas';
import { PasoDescripcion } from '@/components/registro/paso-descripcion';
import { PasoElegirTarjeta } from '@/components/registro/paso-elegir-tarjeta';
import { PasoFecha } from '@/components/registro/paso-fecha';
import { PasoValor } from '@/components/registro/paso-valor';
import { registrarAvance, type DatosAvance } from '@/lib/api/tarjetas';
import { formatearPesos } from '@/lib/dinero';
import { hoy } from '@/lib/fechas';
import {
  ACLARACION_DINERO_RECIBIDO,
  eleccionInicial,
  filasDeTarjeta,
  mensajeAlGuardarCompra,
  NOTA_DE_LA_CUOTA,
  textoDeCuotaDe,
  type EleccionDeTarjeta,
} from '@/lib/tarjetas';
import { useGuardarRegistro } from '@/lib/use-guardar-registro';
import { useState, type ReactNode } from 'react';

type Paso = 'valor' | 'tarjeta' | 'cuotas' | 'fecha' | 'nota';

const ORDEN: Paso[] = ['valor', 'tarjeta', 'cuotas', 'fecha', 'nota'];

type Datos = { valor: string; fecha: string; descripcion: string; eleccion: EleccionDeTarjeta };

/**
 * Avance en efectivo, paso a paso: valor, tarjeta, cuotas, fecha, nota y resumen. No lleva categoría ni método de
 * pago: el dinero entra como dinero recibido (ADR-014).
 */
export function FlujoAvance({ onCerrar }: { onCerrar: () => void }) {
  const [paso, setPaso] = useState<Paso>('valor');
  const [datos, setDatos] = useState<Datos>({
    valor: '',
    fecha: hoy(),
    descripcion: '',
    eleccion: eleccionInicial(),
  });
  const { guardando, error, guardado, guardar } = useGuardarRegistro<{
    cuotas: number;
    cuota: number;
  }>();

  const cambiar = (parcial: Partial<Datos>) => setDatos((d) => ({ ...d, ...parcial }));
  const cambiarEleccion = (parcial: Partial<EleccionDeTarjeta>) =>
    setDatos((d) => ({ ...d, eleccion: { ...d.eleccion, ...parcial } }));
  const { valor, fecha, descripcion, eleccion } = datos;

  async function guardarAvance() {
    if (!eleccion.tarjeta) return;
    const tarjetaId = eleccion.tarjeta.id;
    const nota = descripcion.trim();
    // La nota solo se envía si la escribió: el servidor pone "Avance en efectivo" cuando falta
    const avance: DatosAvance = {
      valor: Number(valor),
      cuotas: Number(eleccion.cuotas),
      primerPago: eleccion.primerPago,
      fecha,
      ...(nota ? { descripcion: nota } : {}),
    };
    await guardar(
      [tarjetaId, avance],
      async (clave) => {
        const { cuotas, cuota } = await registrarAvance(tarjetaId, avance, clave);
        return { cuotas, cuota };
      },
      (e) => mensajeAlGuardarCompra(e, 'avance'),
    );
  }

  if (guardado) {
    return (
      <Confirmacion
        mensaje={`Registramos tu avance de $ ${formatearPesos(Number(valor))} con ${eleccion.tarjeta?.nombre}, ${textoDeCuotaDe(guardado.cuotas, guardado.cuota)}.`}
        aclaracion={ACLARACION_DINERO_RECIBIDO}
        onCerrar={onCerrar}
      />
    );
  }

  return (
    <>
      <EncabezadoRegistro
        titulo="Avance en efectivo"
        paso={ORDEN.indexOf(paso) + 1}
        onCerrar={onCerrar}
      />
      {PASOS[paso]({
        datos,
        guardando,
        error,
        cambiar,
        cambiarEleccion,
        irA: setPaso,
        guardar: () => {
          void guardarAvance();
        },
      })}
    </>
  );
}

type PasoProps = {
  datos: Datos;
  guardando: boolean;
  error: string | null;
  cambiar: (parcial: Partial<Datos>) => void;
  cambiarEleccion: (parcial: Partial<EleccionDeTarjeta>) => void;
  irA: (paso: Paso) => void;
  guardar: () => void;
};

// Cada paso dibuja su pantalla y dice a cuál se va hacia adelante y hacia atrás
const PASOS: Record<Paso, (p: PasoProps) => ReactNode> = {
  // El avance no es un ingreso propio, pero el valor se pide como cualquier monto
  valor: ({ datos, cambiar, irA }) => (
    <PasoValor
      tipo="INGRESO"
      pregunta="¿Cuánto dinero necesitas?"
      valor={datos.valor}
      onCambiar={(valor) => cambiar({ valor })}
      onSiguiente={() => irA('tarjeta')}
    />
  ),
  tarjeta: ({ cambiarEleccion, irA }) => (
    <PasoElegirTarjeta
      pregunta="¿Con cuál tarjeta necesitas el avance?"
      onElegir={(tarjeta) => {
        cambiarEleccion({ tarjeta });
        irA('cuotas');
      }}
      onAtras={() => irA('valor')}
    />
  ),
  cuotas: ({ datos, cambiarEleccion, irA }) =>
    datos.eleccion.tarjeta ? (
      <PasoCuotas
        tarjeta={datos.eleccion.tarjeta}
        valor={Number(datos.valor)}
        eleccion={datos.eleccion}
        onCambiar={cambiarEleccion}
        onSiguiente={(previa) => {
          cambiarEleccion({ previa });
          irA('fecha');
        }}
        onAtras={() => irA('tarjeta')}
      />
    ) : null,
  fecha: ({ datos, cambiar, irA }) => (
    <PasoFecha
      fecha={datos.fecha}
      onCambiar={(fecha) => cambiar({ fecha })}
      onSiguiente={() => irA('nota')}
      onAtras={() => irA('cuotas')}
    />
  ),
  nota: ({ datos, guardando, error, cambiar, irA, guardar }) => (
    <PasoDescripcion
      descripcion={datos.descripcion}
      onCambiar={(descripcion) => cambiar({ descripcion })}
      resumen={{ monto: Number(datos.valor), fecha: datos.fecha }}
      detalles={filasDeTarjeta(datos.eleccion)}
      avisos={[NOTA_DE_LA_CUOTA, ACLARACION_DINERO_RECIBIDO]}
      guardando={guardando}
      error={error}
      onAtras={() => irA('fecha')}
      onGuardar={guardar}
    />
  ),
};
