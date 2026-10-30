import { EncabezadoRegistro } from '@/components/registro/encabezado';
import { PasoCategoria } from '@/components/registro/paso-categoria';
import { PasoDescripcion } from '@/components/registro/paso-descripcion';
import { PasoFecha } from '@/components/registro/paso-fecha';
import { PasoMetodoPago } from '@/components/registro/paso-metodo-pago';
import { PasoValor } from '@/components/registro/paso-valor';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Categoria, TipoMovimiento } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { crearTransaccion, type MetodoPago, type NuevaTransaccion } from '@/lib/api/transacciones';
import { formatearPesos } from '@/lib/dinero';
import { hoy } from '@/lib/fechas';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { View } from 'react-native';

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Tarjeta débito',
  TRANSFERENCIA: 'Transferencia',
};

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

type Datos = {
  valor: string;
  categoria: Categoria | null;
  metodo: MetodoPago | null;
  fecha: string;
  descripcion: string;
};

type Props = { tipo: TipoMovimiento; onCerrar: () => void };

/** Estado y pasos del registro guiado. El tipo (ingreso o egreso) lo fija el botón con el que se entró. */
export function FlujoRegistro({ tipo, onCerrar }: Props) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>({
    valor: '',
    categoria: null,
    metodo: null,
    fecha: hoy(),
    descripcion: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);
  // Clave de idempotencia de la acción en curso: se reutiliza al reintentar y se renueva si cambian los datos
  const intento = useRef<{ huella: string; clave: string } | null>(null);

  function claveDe(nueva: NuevaTransaccion) {
    const huella = JSON.stringify(nueva);
    if (intento.current?.huella !== huella) intento.current = { huella, clave: randomUUID() };
    return intento.current.clave;
  }

  const cambiar = (parcial: Partial<Datos>) => setDatos((d) => ({ ...d, ...parcial }));
  const elegir = (parcial: Partial<Datos>, siguiente: number) => {
    cambiar(parcial);
    setPaso(siguiente);
  };

  async function guardar() {
    const { categoria, metodo, valor, fecha, descripcion } = datos;
    if (!categoria || !metodo || enVuelo.current) return;
    enVuelo.current = true;
    setError(null);
    setGuardando(true);
    try {
      const nueva: NuevaTransaccion = {
        tipo,
        monto: Number(valor),
        fecha,
        categoriaId: categoria.id,
        metodoPago: metodo,
        descripcion: descripcion.trim() || undefined,
      };
      await crearTransaccion(nueva, claveDe(nueva));
      setGuardado(true);
    } catch (e) {
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      setError(mensajeDeError(e));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  if (guardado) return <Confirmacion tipo={tipo} datos={datos} onCerrar={onCerrar} />;

  return (
    <>
      <EncabezadoRegistro
        titulo={tipo === 'EGRESO' ? 'Nuevo egreso' : 'Nuevo ingreso'}
        paso={paso}
        onCerrar={onCerrar}
      />
      <PasoActual
        paso={paso}
        tipo={tipo}
        datos={datos}
        guardando={guardando}
        error={error}
        cambiar={cambiar}
        elegir={elegir}
        irA={setPaso}
        guardar={() => {
          void guardar();
        }}
      />
    </>
  );
}

type PasoActualProps = {
  paso: number;
  tipo: TipoMovimiento;
  datos: Datos;
  guardando: boolean;
  error: string | null;
  cambiar: (parcial: Partial<Datos>) => void;
  elegir: (parcial: Partial<Datos>, siguiente: number) => void;
  irA: (paso: number) => void;
  guardar: () => void;
};

function PasoActual({
  paso,
  tipo,
  datos,
  guardando,
  error,
  cambiar,
  elegir,
  irA,
  guardar,
}: PasoActualProps) {
  switch (paso) {
    case 1:
      return (
        <PasoValor
          tipo={tipo}
          valor={datos.valor}
          onCambiar={(valor) => cambiar({ valor })}
          onSiguiente={() => irA(2)}
        />
      );
    case 2:
      return (
        <PasoCategoria
          tipo={tipo}
          onElegir={(categoria) => elegir({ categoria }, 3)}
          onAtras={() => irA(1)}
        />
      );
    case 3:
      return (
        <PasoMetodoPago
          tipo={tipo}
          onElegir={(metodo) => elegir({ metodo }, 4)}
          onAtras={() => irA(2)}
        />
      );
    case 4:
      return (
        <PasoFecha
          fecha={datos.fecha}
          onCambiar={(fecha) => cambiar({ fecha })}
          onSiguiente={() => irA(5)}
          onAtras={() => irA(3)}
        />
      );
    default:
      return (
        <PasoDescripcion
          descripcion={datos.descripcion}
          onCambiar={(descripcion) => cambiar({ descripcion })}
          resumen={{
            monto: Number(datos.valor),
            categoria: datos.categoria?.nombre ?? '',
            metodo: datos.metodo ? ETIQUETA_METODO[datos.metodo] : '',
            fecha: datos.fecha,
          }}
          guardando={guardando}
          error={error}
          onAtras={() => irA(4)}
          onGuardar={guardar}
        />
      );
  }
}

function Confirmacion({
  tipo,
  datos,
  onCerrar,
}: {
  tipo: TipoMovimiento;
  datos: Datos;
  onCerrar: () => void;
}) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-2xl font-semibold">¡Listo!</Text>
        <Text variant="muted" className="text-center">
          Registramos tu {tipo === 'EGRESO' ? 'egreso' : 'ingreso'} de ${' '}
          {formatearPesos(Number(datos.valor))} en {datos.categoria?.nombre}.
        </Text>
      </View>
      <Button className="h-[50px] w-full" onPress={onCerrar}>
        <Text className="font-semibold">Listo</Text>
      </Button>
    </View>
  );
}
