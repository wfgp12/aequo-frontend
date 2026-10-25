import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { NetworkError } from '@/lib/api/client';
import { listarCategorias, type Categoria, type TipoMovimiento } from '@/lib/api/categorias';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

// Búsqueda sin distinguir mayúsculas ni tildes ("alimentacion" encuentra "Alimentación")
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

type Props = {
  tipo: TipoMovimiento;
  onElegir: (categoria: Categoria) => void;
  onAtras: () => void;
};

/** Paso 2: "¿En qué categoría?". Lista las categorías reales del backend y avanza al tocar una. */
export function PasoCategoria({ tipo, onElegir, onAtras }: Props) {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vigente = true;
    listarCategorias(tipo)
      .then((c) => {
        if (vigente) setCategorias(c);
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión y la app vuelve al login; aquí solo se explican los demás fallos
        if (vigente)
          setError(
            e instanceof NetworkError
              ? 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
              : 'No pudimos cargar tus categorías. Inténtalo de nuevo en unos minutos.',
          );
      });
    return () => {
      vigente = false;
    };
  }, [tipo, intento]);

  function reintentar() {
    setError(null);
    setCategorias(null);
    setIntento((n) => n + 1);
  }

  const visibles = (categorias ?? []).filter((c) =>
    normalizar(c.nombre).includes(normalizar(busqueda.trim())),
  );

  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">¿En qué categoría?</Text>
      <TextInput
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Buscar categoría"
        placeholderTextColor="#757B81"
        accessibilityLabel="Buscar categoría"
        className="mt-3 h-11 rounded-lg bg-muted px-3 text-foreground"
      />

      {error ? (
        <View className="flex-1 items-center justify-center gap-4">
          <Text variant="muted" role="alert" className="text-center">
            {error}
          </Text>
          <Button variant="outline" onPress={reintentar}>
            <Text>Reintentar</Text>
          </Button>
        </View>
      ) : categorias === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="Cargando categorías" />
        </View>
      ) : (
        <View className="mt-3 flex-1 gap-2">
          {visibles.length === 0 ? (
            <Text variant="muted" className="mt-6 text-center">
              No encontramos categorías con ese nombre.
            </Text>
          ) : (
            visibles.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.nombre}
                onPress={() => onElegir(c)}
                className="h-12 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3"
              >
                <View className="size-5 rounded-full bg-muted" />
                <Text className="flex-1">{c.nombre}</Text>
                {c.esPredeterminada ? null : (
                  <Text variant="muted" className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    Personal
                  </Text>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}

      <Button variant="outline" className="h-[50px] w-full" onPress={onAtras}>
        <Text className="font-semibold">Atrás</Text>
      </Button>
    </View>
  );
}
