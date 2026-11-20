import { Confirmacion } from '@/components/registro/confirmacion';
import { EncabezadoRegistro } from '@/components/registro/encabezado';
import { PasoCategoria } from '@/components/registro/paso-categoria';
import { PasoCuotas } from '@/components/registro/paso-cuotas';
import { PasoDescripcion } from '@/components/registro/paso-descripcion';
import { PasoElegirTarjeta } from '@/components/registro/paso-elegir-tarjeta';
import { PasoFecha } from '@/components/registro/paso-fecha';
import { PasoMetodoPago } from '@/components/registro/paso-metodo-pago';
import { PasoValor } from '@/components/registro/paso-valor';
import type { Categoria, TipoMovimiento } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { registrarCompra, type CompraCredito, type DatosCompra } from '@/lib/api/tarjetas';
import { crearTransaccion, type NuevaTransaccion } from '@/lib/api/transacciones';
import { formatearPesos } from '@/lib/dinero';
import { hoy } from '@/lib/fechas';
import type { OpcionDeMetodo } from '@/lib/metodos-de-pago';
import { ETIQUETA_METODO } from '@/lib/movimientos';
import {
  eleccionInicial,
  filasDeTarjeta,
  mensajeAlGuardarCompra,
  NOTA_DE_LA_CUOTA,
  textoDeCuotaDe,
  type EleccionDeTarjeta,
} from '@/lib/tarjetas';
import { useGuardarRegistro } from '@/lib/use-guardar-registro';
import { useState, type ReactNode } from 'react';

// Lenguaje cotidiano, sin jerga técnica (RNF-04)
function mensajeDeError(e: unknown) {
  if (e instanceof NetworkError) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  // 409: el backend sigue procesando el primer intento con esta misma clave
  if (e instanceof ApiError && e.status === 409) {
    return 'Tu movimiento todavía se está guardando. Espera unos segundos e inténtalo de nuevo.';
  }
  return 'No pudimos guardar tu movimiento. Revisa los datos e inténtalo de nuevo.';
}

type Paso = 'valor' | 'categoria' | 'metodo' | 'tarjeta' | 'cuotas' | 'fecha' | 'nota';

// La tarjeta y las cuotas son la continuación del método de pago: la barra de cinco tramos no cambia
const NUMERO_DE_PASO: Record<Paso, number> = {
  valor: 1,
  categoria: 2,
  metodo: 3,
  tarjeta: 3,
  cuotas: 3,
  fecha: 4,
  nota: 5,
};

type Datos = {
  valor: string;
  categoria: Categoria | null;
  metodo: OpcionDeMetodo['valor'] | null;
  fecha: string;
  descripcion: string;
  eleccion: EleccionDeTarjeta;
};

type Props = { tipo: TipoMovimiento; onCerrar: () => void };

/** Estado y pasos del registro guiado. El tipo (ingreso o egreso) lo fija el botón con el que se entró. */
export function FlujoRegistro({ tipo, onCerrar }: Props) {
  const [paso, setPaso] = useState<Paso>('valor');
  const [datos, setDatos] = useState<Datos>({
    valor: '',
    categoria: null,
    metodo: null,
    fecha: hoy(),
    descripcion: '',
    eleccion: eleccionInicial(),
  });
  // `compra` es la respuesta del guardado de una compra con tarjeta; null si se guardó un movimiento
  const { guardando, error, guardado, guardar } = useGuardarRegistro<{
    compra: CompraCredito | null;
  }>();

  const cambiar = (parcial: Partial<Datos>) => setDatos((d) => ({ ...d, ...parcial }));
  const cambiarEleccion = (parcial: Partial<EleccionDeTarjeta>) =>
    setDatos((d) => ({ ...d, eleccion: { ...d.eleccion, ...parcial } }));
  const elegir = (parcial: Partial<Datos>, siguiente: Paso) => {
    cambiar(parcial);
    setPaso(siguiente);
  };
  const conTarjeta = datos.metodo === 'TARJETA_CREDITO';

  async function guardarRegistro() {
    const { categoria, metodo, valor, fecha, descripcion, eleccion } = datos;
    if (!categoria || !metodo) return;
    const nota = descripcion.trim();
    if (metodo === 'TARJETA_CREDITO') {
      if (!eleccion.tarjeta) return;
      const tarjetaId = eleccion.tarjeta.id;
      // Sin nota, la descripción es la categoría: el backend exige una
      const compra: DatosCompra = {
        descripcion: nota || categoria.nombre,
        categoriaId: categoria.id,
        valor: Number(valor),
        cuotas: Number(eleccion.cuotas),
        primerPago: eleccion.primerPago,
        fecha,
      };
      await guardar(
        [tarjetaId, compra],
        async (clave) => ({ compra: await registrarCompra(tarjetaId, compra, clave) }),
        (e) => mensajeAlGuardarCompra(e, 'compra'),
      );
      return;
    }
    const nueva: NuevaTransaccion = {
      tipo,
      monto: Number(valor),
      fecha,
      categoriaId: categoria.id,
      metodoPago: metodo,
      descripcion: nota || undefined,
    };
    await guardar(
      nueva,
      async (clave) => {
        await crearTransaccion(nueva, clave);
        return { compra: null };
      },
      mensajeDeError,
    );
  }

  if (guardado) {
    const { valor, categoria, eleccion } = datos;
    const { compra } = guardado;
    return (
      <Confirmacion
        mensaje={
          compra
            ? `Registramos tu compra de $ ${formatearPesos(Number(valor))} en ${categoria?.nombre} con ${eleccion.tarjeta?.nombre}, ${textoDeCuotaDe(compra.cuotas, compra.cuota)}.`
            : `Registramos tu ${tipo === 'EGRESO' ? 'egreso' : 'ingreso'} de $ ${formatearPesos(Number(valor))} en ${categoria?.nombre}.`
        }
        onCerrar={onCerrar}
      />
    );
  }

  return (
    <>
      <EncabezadoRegistro
        titulo={
          paso === 'tarjeta' || paso === 'cuotas'
            ? 'Tarjeta de crédito'
            : tipo === 'EGRESO'
              ? 'Nuevo egreso'
              : 'Nuevo ingreso'
        }
        paso={NUMERO_DE_PASO[paso]}
        onCerrar={onCerrar}
      />
      {PASOS[paso]({
        tipo,
        datos,
        conTarjeta,
        guardando,
        error,
        cambiar,
        cambiarEleccion,
        elegir,
        irA: setPaso,
        guardar: () => {
          void guardarRegistro();
        },
      })}
    </>
  );
}

type PasoProps = {
  tipo: TipoMovimiento;
  datos: Datos;
  conTarjeta: boolean;
  guardando: boolean;
  error: string | null;
  cambiar: (parcial: Partial<Datos>) => void;
  cambiarEleccion: (parcial: Partial<EleccionDeTarjeta>) => void;
  elegir: (parcial: Partial<Datos>, siguiente: Paso) => void;
  irA: (paso: Paso) => void;
  guardar: () => void;
};

// Cada paso dibuja su pantalla y dice a cuál se va hacia adelante y hacia atrás
const PASOS: Record<Paso, (p: PasoProps) => ReactNode> = {
  valor: ({ tipo, datos, cambiar, irA }) => (
    <PasoValor
      tipo={tipo}
      valor={datos.valor}
      onCambiar={(valor) => cambiar({ valor })}
      onSiguiente={() => irA('categoria')}
    />
  ),
  categoria: ({ tipo, elegir, irA }) => (
    <PasoCategoria
      tipo={tipo}
      onElegir={(categoria) => elegir({ categoria }, 'metodo')}
      onAtras={() => irA('valor')}
    />
  ),
  metodo: ({ tipo, elegir, irA }) => (
    <PasoMetodoPago
      tipo={tipo}
      onElegir={(metodo) => elegir({ metodo }, metodo === 'TARJETA_CREDITO' ? 'tarjeta' : 'fecha')}
      onAtras={() => irA('categoria')}
    />
  ),
  tarjeta: ({ cambiarEleccion, irA }) => (
    <PasoElegirTarjeta
      pregunta="¿Con cuál tarjeta fue?"
      onElegir={(tarjeta) => {
        cambiarEleccion({ tarjeta });
        irA('cuotas');
      }}
      onAtras={() => irA('metodo')}
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
  fecha: ({ datos, conTarjeta, cambiar, irA }) => (
    <PasoFecha
      fecha={datos.fecha}
      onCambiar={(fecha) => cambiar({ fecha })}
      onSiguiente={() => irA('nota')}
      onAtras={() => irA(conTarjeta ? 'cuotas' : 'metodo')}
    />
  ),
  nota: ({ datos, conTarjeta, guardando, error, cambiar, irA, guardar }) => (
    <PasoDescripcion
      descripcion={datos.descripcion}
      onCambiar={(descripcion) => cambiar({ descripcion })}
      resumen={{
        monto: Number(datos.valor),
        categoria: datos.categoria?.nombre ?? '',
        metodo: datos.metodo ? ETIQUETA_METODO[datos.metodo] : '',
        fecha: datos.fecha,
      }}
      detalles={conTarjeta ? filasDeTarjeta(datos.eleccion) : undefined}
      avisos={conTarjeta ? [NOTA_DE_LA_CUOTA] : undefined}
      guardando={guardando}
      error={error}
      onAtras={() => irA('fecha')}
      onGuardar={guardar}
    />
  ),
};
