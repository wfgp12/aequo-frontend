import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { crearCategoria, type Categoria, type TipoMovimiento } from '@/lib/api/categorias';
import { ApiError, NetworkError } from '@/lib/api/client';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, TextInput, View } from 'react-native';

const MAX_NOMBRE = 40;

function mensajeDeError(e: unknown) {
  if (e instanceof NetworkError)
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (e instanceof ApiError && e.status === 409)
    return 'Ya existe una categoría con ese nombre. Prueba con otro.';
  return 'No pudimos guardar la categoría. Revisa el nombre e inténtalo de nuevo.';
}

type Props = {
  tipo: TipoMovimiento;
  onCerrar: () => void;
  /** La categoría que devolvió el backend (puede venir normalizada). */
  onCreada: (categoria: Categoria) => void;
};

/** Hoja "Nueva categoría": el tipo lo fija el selector desde el que se abre, solo se pide el nombre. */
export function HojaNuevaCategoria({ tipo, onCerrar, onCreada }: Props) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bandera síncrona: dos toques muy rápidos pueden entrar antes de que se repinte el botón
  const enVuelo = useRef(false);
  // Clave de la acción en curso: se reutiliza al reintentar y se renueva si cambia el nombre
  const intento = useRef<{ nombre: string; clave: string } | null>(null);

  async function guardar() {
    if (enVuelo.current) return;
    const limpio = nombre.trim();
    if (limpio === '') return setError('Escribe un nombre para la categoría.');
    if (limpio.length > MAX_NOMBRE) return setError('El nombre puede tener hasta 40 letras.');
    if (intento.current?.nombre !== limpio)
      intento.current = { nombre: limpio, clave: randomUUID() };
    enVuelo.current = true;
    setError(null);
    setGuardando(true);
    try {
      onCreada(await crearCategoria({ nombre: limpio, tipo }, intento.current.clave));
    } catch (e) {
      // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
      if (!(e instanceof ApiError && e.status === 401)) setError(mensajeDeError(e));
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          accessibilityViewIsModal
          className="w-full max-w-[420px] self-center rounded-t-3xl bg-background px-5 pb-6 pt-4"
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
            <Text className="text-lg font-semibold">Nueva categoría</Text>
            <View className="w-5" />
          </View>

          <Text variant="muted" className="mb-1 mt-4 text-xs font-semibold">
            Tipo
          </Text>
          <Text className="h-12 rounded-lg bg-muted px-3 py-3">
            {tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
          </Text>

          <Text variant="muted" className="mb-1 mt-4 text-xs font-semibold">
            Nombre
          </Text>
          <TextInput
            value={nombre}
            onChangeText={(t) => {
              setNombre(t);
              setError(null);
            }}
            placeholder="Ej. Mascotas"
            placeholderTextColor="#757B81"
            accessibilityLabel="Nombre"
            className="h-12 rounded-lg border border-border bg-card px-3 text-foreground"
          />

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
            disabled={guardando}
            onPress={() => {
              void guardar();
            }}
          >
            {guardando ? <ActivityIndicator /> : <Text className="font-semibold">Guardar</Text>}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
