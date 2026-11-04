import { Calendario } from '@/components/calendario';
import { CampoMonto } from '@/components/campo-monto';
import { ListaDeCategorias } from '@/components/categorias/lista-de-categorias';
import { DialogoEliminarMovimiento } from '@/components/movimientos/dialogo-eliminar-movimiento';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { TipoMovimiento } from '@/lib/api/categorias';
import { ApiError } from '@/lib/api/client';
import {
  actualizarTransaccion,
  MAX_DESCRIPCION,
  type TransaccionListada,
} from '@/lib/api/transacciones';
import { fechaDdMmAaaa } from '@/lib/fechas';
import {
  AVISO_TARJETA_DE_CREDITO,
  opcionesDeMetodo,
  type OpcionDeMetodo,
} from '@/lib/metodos-de-pago';
import {
  avisoDeCategoria,
  cambiosDelFormulario,
  ETIQUETA_METODO,
  formularioDesde,
  mensajeAlGuardar,
  type FormularioMovimiento,
} from '@/lib/movimientos';
import { cn } from '@/lib/utils';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

type Selector = 'categoria' | 'metodo' | 'fecha' | null;

type Props = {
  item: TransaccionListada;
  onCerrar: () => void;
  /** Algo cambió en el servidor (se guardó, se eliminó o ya no existe): la lista debe volver a cargarse. */
  onCambio: () => void;
};

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View className="mt-4">
      <Text variant="muted" className="mb-1 text-xs font-semibold">
        {etiqueta}
      </Text>
      {children}
    </View>
  );
}

/** Campo con una fila tocable que muestra el valor actual y, al abrirse, despliega su selector debajo. */
function CampoSelector({
  etiqueta,
  valor,
  abierto,
  onPress,
  children,
}: {
  etiqueta: string;
  valor: string;
  abierto: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}, ${valor}`}
        accessibilityState={{ expanded: abierto }}
        onPress={onPress}
        className="h-12 flex-row items-center justify-between rounded-lg border border-border bg-card px-3"
      >
        <Text className={cn(valor === '' && 'text-muted-foreground')}>{valor || 'Elegir'}</Text>
        <Text variant="muted">{abierto ? '˄' : '˅'}</Text>
      </Pressable>
      {abierto ? <View className="mt-2">{children}</View> : null}
    </Campo>
  );
}

function SelectorDeTipo({
  tipo,
  onCambiar,
}: {
  tipo: TipoMovimiento;
  onCambiar: (tipo: TipoMovimiento) => void;
}) {
  return (
    <View className="mt-4 flex-row gap-2 rounded-full bg-muted p-1">
      {(['INGRESO', 'EGRESO'] as const).map((valor) => {
        const etiqueta = valor === 'INGRESO' ? 'Ingreso' : 'Egreso';
        return (
          <Pressable
            key={valor}
            accessibilityRole="button"
            accessibilityLabel={etiqueta}
            accessibilityState={{ selected: tipo === valor }}
            onPress={() => onCambiar(valor)}
            className={cn(
              'h-10 flex-1 items-center justify-center rounded-full',
              tipo === valor && 'bg-foreground',
            )}
          >
            <Text className={cn('text-sm font-semibold', tipo === valor && 'text-background')}>
              {etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OpcionesDeMetodo({
  tipo,
  aviso,
  onElegir,
}: {
  tipo: TipoMovimiento;
  aviso: string | null;
  onElegir: (valor: OpcionDeMetodo['valor']) => void;
}) {
  return (
    <View className="gap-2">
      {opcionesDeMetodo(tipo).map((o) => (
        <Pressable
          key={o.valor}
          accessibilityRole="button"
          accessibilityLabel={o.etiqueta}
          onPress={() => onElegir(o.valor)}
          className="h-12 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3"
        >
          <View className="size-5 rounded-full bg-muted" />
          <Text>{o.etiqueta}</Text>
        </Pressable>
      ))}
      {aviso ? (
        <Text variant="muted" role="alert" className="text-xs">
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Hoja "Editar movimiento" del wireframe de Figma: todos los campos a la vista, "Guardar cambios" que envía solo
 * lo que cambió, y "Eliminar movimiento", que siempre pide confirmar.
 */
export function HojaEditarMovimiento({ item, onCerrar, onCambio }: Props) {
  const [form, setForm] = useState<FormularioMovimiento>(() => formularioDesde(item));
  const [abierto, setAbierto] = useState<Selector>(null);
  const [avisoMetodo, setAvisoMetodo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón deshabilitado
  const enVuelo = useRef(false);

  const cambiar = (parcial: Partial<FormularioMovimiento>) =>
    setForm((f) => ({ ...f, ...parcial }));
  const alternar = (selector: Exclude<Selector, null>) =>
    setAbierto((actual) => (actual === selector ? null : selector));

  function cambiarTipo(tipo: TipoMovimiento) {
    if (tipo === form.tipo) return;
    // Cada tipo tiene sus propias categorías: al cambiar hay que elegir una del tipo nuevo
    // (si el usuario vuelve al tipo original, se recupera la categoría original)
    cambiar({ tipo, categoria: tipo === item.tipo ? formularioDesde(item).categoria : null });
    setAbierto(null);
    setError(null);
  }

  function elegirMetodo(valor: OpcionDeMetodo['valor']) {
    if (valor === 'TARJETA_CREDITO') {
      setAvisoMetodo(AVISO_TARJETA_DE_CREDITO);
      return;
    }
    setAvisoMetodo(null);
    cambiar({ metodo: valor });
    setAbierto(null);
  }

  async function guardar() {
    // Mientras se muestra el aviso de la tarjeta de crédito falta elegir otro método
    if (enVuelo.current || avisoMetodo) return;
    if (!form.categoria) {
      setError(avisoDeCategoria(form.tipo));
      return;
    }
    const cambios = cambiosDelFormulario(item, form);
    if (Object.keys(cambios).length === 0) {
      onCerrar();
      return;
    }
    enVuelo.current = true;
    setError(null);
    setGuardando(true);
    try {
      await actualizarTransaccion(item.id, cambios);
      onCambio();
      onCerrar();
    } catch (e) {
      // Si ya no existe, la lista debe dejar de mostrarlo aunque la hoja siga abierta con el aviso
      if (e instanceof ApiError && e.status === 404) onCambio();
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      setError(mensajeAlGuardar(e));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  return (
    <>
      <Modal transparent animationType="slide" onRequestClose={onCerrar}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            accessibilityViewIsModal
            className="max-h-[720px] w-full max-w-[420px] self-center rounded-t-3xl bg-background px-5 pb-6 pt-4"
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={onCerrar}
                hitSlop={12}
              >
                <Text className="text-xl">✕</Text>
              </Pressable>
              <Text className="text-lg font-semibold">Editar movimiento</Text>
              <View className="w-5" />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <SelectorDeTipo tipo={form.tipo} onCambiar={cambiarTipo} />

              <Campo etiqueta="Valor">
                <CampoMonto
                  valor={form.valor}
                  onCambiar={(valor) => cambiar({ valor })}
                  className="h-12 rounded-lg border border-border bg-card px-3 text-base"
                />
              </Campo>

              <CampoSelector
                etiqueta="Categoría"
                valor={form.categoria?.nombre ?? ''}
                abierto={abierto === 'categoria'}
                onPress={() => alternar('categoria')}
              >
                <ListaDeCategorias
                  tipo={form.tipo}
                  seleccionada={form.categoria?.id}
                  onElegir={(categoria) => {
                    cambiar({ categoria });
                    setError(null);
                    setAbierto(null);
                  }}
                />
              </CampoSelector>

              <CampoSelector
                etiqueta="Método de pago"
                valor={ETIQUETA_METODO[form.metodo]}
                abierto={abierto === 'metodo'}
                onPress={() => alternar('metodo')}
              >
                <OpcionesDeMetodo tipo={form.tipo} aviso={avisoMetodo} onElegir={elegirMetodo} />
              </CampoSelector>

              <CampoSelector
                etiqueta="Fecha"
                valor={fechaDdMmAaaa(form.fecha)}
                abierto={abierto === 'fecha'}
                onPress={() => alternar('fecha')}
              >
                <Calendario
                  valor={form.fecha}
                  onElegir={(fecha) => {
                    cambiar({ fecha });
                    setAbierto(null);
                  }}
                />
              </CampoSelector>

              <Campo etiqueta="Descripción (opcional)">
                <TextInput
                  value={form.descripcion}
                  onChangeText={(descripcion) => cambiar({ descripcion })}
                  placeholder="Agrega una nota"
                  placeholderTextColor="#757B81"
                  maxLength={MAX_DESCRIPCION}
                  accessibilityLabel="Descripción (opcional)"
                  className="h-12 rounded-lg border border-border bg-card px-3 text-foreground"
                />
              </Campo>

              {error ? (
                <Text
                  variant="muted"
                  role="alert"
                  className="mt-4 text-center text-xs text-destructive"
                >
                  {error}
                </Text>
              ) : null}

              <Button
                className="mt-4 h-[50px] w-full"
                disabled={Number(form.valor) <= 0 || guardando}
                onPress={() => {
                  void guardar();
                }}
              >
                {guardando ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-semibold">Guardar cambios</Text>
                )}
              </Button>
              <Button
                variant="outline"
                className="mt-3 h-[50px] w-full"
                disabled={guardando}
                onPress={() => setConfirmando(true)}
              >
                <Text className="font-semibold text-destructive">Eliminar movimiento</Text>
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {confirmando ? (
        <DialogoEliminarMovimiento
          item={item}
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
