import { Calendario } from '@/components/calendario';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ayer, fechaLarga, hoy } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

type Modo = 'hoy' | 'ayer' | 'otra';

const OPCIONES: { modo: Modo; etiqueta: string }[] = [
  { modo: 'hoy', etiqueta: 'Hoy' },
  { modo: 'ayer', etiqueta: 'Ayer' },
  { modo: 'otra', etiqueta: 'Otra fecha' },
];

type Props = {
  /** Fecha elegida, en formato YYYY-MM-DD. */
  fecha: string;
  onCambiar: (iso: string) => void;
  onSiguiente: () => void;
  onAtras: () => void;
};

function modoInicial(fecha: string): Modo {
  if (fecha === hoy()) return 'hoy';
  if (fecha === ayer()) return 'ayer';
  return 'otra';
}

/** Paso 4: "¿Cuándo fue?". Hoy por defecto, ayer, u otra fecha con calendario. */
export function PasoFecha({ fecha, onCambiar, onSiguiente, onAtras }: Props) {
  const [modo, setModo] = useState<Modo>(() => modoInicial(fecha));

  function elegir(nuevo: Modo) {
    setModo(nuevo);
    if (nuevo === 'hoy') onCambiar(hoy());
    if (nuevo === 'ayer') onCambiar(ayer());
  }

  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">¿Cuándo fue?</Text>
      <View className="mt-3 flex-row gap-2">
        {OPCIONES.map(({ modo: valor, etiqueta }) => (
          <Pressable
            key={valor}
            accessibilityRole="button"
            accessibilityState={{ selected: modo === valor }}
            onPress={() => elegir(valor)}
            className={cn(
              'h-10 flex-1 items-center justify-center rounded-full border border-border',
              modo === valor && 'border-foreground bg-foreground',
            )}
          >
            <Text className={cn('text-sm', modo === valor && 'text-background')}>{etiqueta}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="muted" className="mt-3 text-xs">
        {fechaLarga(fecha)}
      </Text>

      <View className="mt-3 flex-1">
        {modo === 'otra' ? <Calendario valor={fecha} onElegir={onCambiar} /> : null}
      </View>

      <View className="flex-row gap-3">
        <Button variant="outline" className="h-[50px] flex-1" onPress={onAtras}>
          <Text className="font-semibold">Atrás</Text>
        </Button>
        <Button className="h-[50px] flex-1" onPress={onSiguiente}>
          <Text className="font-semibold">Siguiente</Text>
        </Button>
      </View>
    </View>
  );
}
