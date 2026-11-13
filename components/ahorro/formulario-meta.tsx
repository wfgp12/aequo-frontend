import { CampoPorcentaje } from '@/components/ahorro/campo-porcentaje';
import { DialogoQuitarMeta } from '@/components/ahorro/dialogo-quitar-meta';
import { CampoMonto } from '@/components/campo-monto';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  actualizarMeta,
  crearMeta,
  obtenerMetaDelMes,
  type MetaAhorro,
  type TipoMeta,
} from '@/lib/api/ahorro';
import { ApiError, NetworkError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

type Aviso = { texto: string; exito?: boolean };

const TIPOS: { tipo: TipoMeta; nombre: string }[] = [
  { tipo: 'MONTO_FIJO', nombre: 'Monto' },
  { tipo: 'PORCENTAJE', nombre: 'Porcentaje' },
];

const AYUDA: Record<TipoMeta, string> = {
  MONTO_FIJO:
    'Es lo que quieres que te quede cada mes después de restar tus egresos a tus ingresos.',
  PORCENTAJE:
    'Es la parte de tus ingresos que quieres que te quede cada mes, después de restar tus egresos.',
};

const ERROR_RED = 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
const ERROR_GENERAL = 'No pudimos guardar tu meta. Revisa el valor e inténtalo de nuevo.';
const esApi = (e: unknown, status: number) => e instanceof ApiError && e.status === status;

type Lectura = { valor: number } | { error: string };

/** El valor escrito como número (monto en pesos o porcentaje con coma), o el aviso de por qué no se puede guardar. */
function leerValor(tipo: TipoMeta, texto: string): Lectura {
  const valor = Number(texto.replace(',', '.')) || 0;
  if (valor <= 0)
    return {
      error:
        tipo === 'MONTO_FIJO'
          ? 'Escribe un monto mayor que cero.'
          : 'Escribe un porcentaje mayor que 0.',
    };
  if (tipo === 'PORCENTAJE' && valor > 100)
    return { error: 'El porcentaje no puede pasar de 100.' };
  return { valor };
}

/** El valor de la meta como lo muestra el campo: pesos enteros, o porcentaje con coma decimal. */
function textoDelValor(meta: MetaAhorro) {
  return meta.tipoMeta === 'MONTO_FIJO'
    ? String(Math.round(meta.valorObjetivo))
    : String(meta.valorObjetivo).replace('.', ',');
}

function SelectorDeTipo({
  tipo,
  onElegir,
}: {
  tipo: TipoMeta;
  onElegir: (tipo: TipoMeta) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {TIPOS.map(({ tipo: valor, nombre }) => (
        <Pressable
          key={valor}
          accessibilityRole="button"
          accessibilityLabel={nombre}
          accessibilityState={{ selected: tipo === valor }}
          onPress={() => onElegir(valor)}
          className={cn(
            'min-h-11 flex-1 items-center justify-center rounded-lg border border-input',
            tipo === valor && 'border-primary bg-primary',
          )}
        >
          <Text className={cn('font-semibold', tipo === valor && 'text-primary-foreground')}>
            {nombre}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function AvisoDeMeta({ aviso }: { aviso: Aviso | null }) {
  if (!aviso) return null;
  return (
    <Text
      variant="muted"
      role={aviso.exito ? undefined : 'alert'}
      className={cn('text-center text-xs', !aviso.exito && 'text-destructive')}
    >
      {aviso.texto}
    </Text>
  );
}

/** "Quitar meta" con su diálogo de confirmación: el diálogo se cierra solo cuando la meta ya no existe. */
function QuitarMeta({
  metaId,
  mesLargo,
  onQuitada,
}: {
  metaId: string;
  mesLargo: string;
  onQuitada: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <>
      <Button variant="ghost" onPress={() => setConfirmando(true)}>
        <Text>Quitar meta</Text>
      </Button>
      {confirmando ? (
        <DialogoQuitarMeta
          metaId={metaId}
          mes={mesLargo}
          onCancelar={() => setConfirmando(false)}
          onQuitada={onQuitada}
        />
      ) : null}
    </>
  );
}

type Props = {
  /** La meta del mes que ya está guardada, o null si todavía no hay. */
  metaInicial: MetaAhorro | null;
  /** YYYY-MM */
  mes: string;
  /** "septiembre de 2026" */
  mesLargo: string;
  /** La meta del mes cambió (o se descubrió que la del servidor es otra): quien la muestra debe refrescarse. */
  onMetaCambiada: () => void;
};

/**
 * Formulario de la meta del mes: elegir monto o porcentaje, guardar (crea o edita) y quitar.
 * Solo envía lo escrito: el backend calcula todo lo demás.
 */
export function FormularioMeta({ metaInicial, mes, mesLargo, onMetaCambiada }: Props) {
  const [metaId, setMetaId] = useState(metaInicial?.id ?? null);
  const [tipo, setTipo] = useState<TipoMeta>(metaInicial?.tipoMeta ?? 'MONTO_FIJO');
  // Cada tipo recuerda su propio valor: un monto y un porcentaje no son comparables
  const [valores, setValores] = useState<Record<TipoMeta, string>>({
    MONTO_FIJO: '',
    PORCENTAJE: '',
    ...(metaInicial && { [metaInicial.tipoMeta]: textoDelValor(metaInicial) }),
  });
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón
  const enVuelo = useRef(false);
  // Clave de la creación en curso: se reutiliza al reintentar y se renueva si cambia el tipo o el valor
  const intento = useRef<{ tipo: TipoMeta; valor: number; clave: string } | null>(null);

  /** Muestra la meta que devolvió el backend (puede venir normalizada). */
  function mostrarMeta(meta: MetaAhorro) {
    setMetaId(meta.id);
    setTipo(meta.tipoMeta);
    setValores((v) => ({ ...v, [meta.tipoMeta]: textoDelValor(meta) }));
  }

  function cambiar(accion: () => void) {
    accion();
    setAviso(null);
  }

  async function enviar(valor: number) {
    if (metaId) return actualizarMeta(metaId, { tipoMeta: tipo, valorObjetivo: valor });
    if (intento.current?.tipo !== tipo || intento.current.valor !== valor)
      intento.current = { tipo, valor, clave: randomUUID() };
    const creada = await crearMeta(
      { tipoMeta: tipo, valorObjetivo: valor, periodo: mes },
      intento.current.clave,
    );
    intento.current = null;
    return creada;
  }

  // Otra pestaña o dispositivo ya creó la meta del mes: se muestra la que está guardada
  async function mostrarLaGuardada() {
    try {
      const existente = await obtenerMetaDelMes(mes);
      // Si ya no está (la quitaron justo después), se conserva lo escrito y el siguiente guardado crea
      if (existente) mostrarMeta(existente);
      setAviso({ texto: 'Ya tienes una meta para este mes. Te mostramos la que está guardada.' });
    } catch (e) {
      if (!esApi(e, 401)) setAviso({ texto: ERROR_GENERAL });
    }
  }

  async function explicarFallo(e: unknown) {
    // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
    if (esApi(e, 401)) return;
    if (e instanceof NetworkError) return setAviso({ texto: ERROR_RED });
    if (metaId && esApi(e, 404)) {
      // La meta la quitaron en otro lado: lo escrito se conserva y el siguiente guardado crea una nueva
      setMetaId(null);
      onMetaCambiada();
      return setAviso({
        texto: 'Esta meta ya no existe. Vuelve a guardarla para crearla de nuevo.',
      });
    }
    if (!metaId && esApi(e, 409)) {
      onMetaCambiada();
      return mostrarLaGuardada();
    }
    setAviso({ texto: ERROR_GENERAL });
  }

  async function guardar() {
    if (enVuelo.current) return;
    const leido = leerValor(tipo, valores[tipo]);
    if ('error' in leido) return setAviso({ texto: leido.error });
    enVuelo.current = true;
    setAviso(null);
    setGuardando(true);
    try {
      mostrarMeta(await enviar(leido.valor));
      setAviso({ texto: 'Meta guardada.', exito: true });
      onMetaCambiada();
    } catch (e) {
      await explicarFallo(e);
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  function alQuitar() {
    setMetaId(null);
    setValores({ MONTO_FIJO: '', PORCENTAJE: '' });
    setTipo('MONTO_FIJO');
    intento.current = null;
    setAviso({ texto: 'Meta quitada.', exito: true });
    onMetaCambiada();
  }

  return (
    <>
      <SelectorDeTipo tipo={tipo} onElegir={(nuevo) => cambiar(() => setTipo(nuevo))} />

      <View>
        <Text variant="muted" className="mb-1 text-xs font-semibold">
          Meta mensual
        </Text>
        {tipo === 'MONTO_FIJO' ? (
          <CampoMonto
            valor={valores.MONTO_FIJO}
            onCambiar={(digitos) =>
              cambiar(() => setValores((v) => ({ ...v, MONTO_FIJO: digitos })))
            }
            className="h-12 rounded-lg border border-border bg-card px-3"
          />
        ) : (
          <CampoPorcentaje
            valor={valores.PORCENTAJE}
            onCambiar={(texto) => cambiar(() => setValores((v) => ({ ...v, PORCENTAJE: texto })))}
            className="h-12 rounded-lg border border-border bg-card px-3"
          />
        )}
        <Text variant="muted" className="mt-2 text-xs">
          {AYUDA[tipo]}
        </Text>
      </View>

      <Text variant="muted" className="text-xs">
        {`Esta meta es para ${mesLargo}. Cada mes puedes fijar la tuya.`}
      </Text>

      <AvisoDeMeta aviso={aviso} />

      <Button
        className="h-[50px] w-full"
        disabled={guardando}
        onPress={() => {
          void guardar();
        }}
      >
        {guardando ? <ActivityIndicator /> : <Text className="font-semibold">Guardar meta</Text>}
      </Button>

      {metaId ? <QuitarMeta metaId={metaId} mesLargo={mesLargo} onQuitada={alQuitar} /> : null}
    </>
  );
}
