import { Calendario } from '@/components/calendario';
import { SelectorDePildoras } from '@/components/selector-de-pildoras';
import { Text } from '@/components/ui/text';
import { ayer, fechaLarga, hoy } from '@/lib/fechas';
import { useState } from 'react';
import { View } from 'react-native';

type Modo = 'hoy' | 'ayer' | 'otra';

const OPCIONES: { valor: Modo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'ayer', etiqueta: 'Ayer' },
  { valor: 'otra', etiqueta: 'Otra fecha' },
];

type Props = {
  /** Fecha elegida, en formato YYYY-MM-DD. */
  fecha: string;
  onCambiar: (iso: string) => void;
};

function modoInicial(fecha: string): Modo {
  if (fecha === hoy()) return 'hoy';
  if (fecha === ayer()) return 'ayer';
  return 'otra';
}

/** Hoy, ayer u otra fecha con calendario, con la fecha elegida en letras debajo. */
export function SelectorDeFecha({ fecha, onCambiar }: Props) {
  const [modo, setModo] = useState<Modo>(() => modoInicial(fecha));

  function elegir(nuevo: Modo) {
    setModo(nuevo);
    if (nuevo === 'hoy') onCambiar(hoy());
    if (nuevo === 'ayer') onCambiar(ayer());
  }

  return (
    <View>
      <SelectorDePildoras opciones={OPCIONES} valor={modo} onElegir={elegir} />
      <Text variant="muted" className="mt-3 text-xs">
        {fechaLarga(fecha)}
      </Text>
      {modo === 'otra' ? (
        <View className="mt-3">
          <Calendario valor={fecha} onElegir={onCambiar} />
        </View>
      ) : null}
    </View>
  );
}
