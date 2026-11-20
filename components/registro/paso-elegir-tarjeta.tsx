import { HojaTarjeta } from '@/components/tarjetas/hoja-tarjeta';
import { BotonAgregar, EstadoDeLista, FilaDeLista } from '@/components/tarjetas/pantalla-de-lista';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Tarjeta } from '@/lib/api/tarjetas';
import { textoDeTasa } from '@/lib/tarjetas';
import { useTarjetas } from '@/lib/use-tarjetas';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

type Props = {
  /** "¿Con cuál tarjeta fue?" en la compra; "¿Con cuál tarjeta necesitas el avance?" en el avance. */
  pregunta: string;
  onElegir: (tarjeta: Tarjeta) => void;
  onAtras: () => void;
};

/**
 * Paso "elegir la tarjeta" de la compra con tarjeta y del avance en efectivo. La lista se pide al llegar; la hoja
 * "Nueva tarjeta" se abre encima, sin salir del registro, y la tarjeta creada aparece como una opción más.
 */
export function PasoElegirTarjeta({ pregunta, onElegir, onAtras }: Props) {
  const { cargando, items, fallo, recargar } = useTarjetas();
  const [creando, setCreando] = useState(false);

  return (
    <View className="flex-1">
      <Text className="mt-6 text-lg font-semibold">{pregunta}</Text>
      <ScrollView
        className="mt-3 flex-1"
        contentContainerClassName="gap-2"
        keyboardShouldPersistTaps="handled"
      >
        <EstadoDeLista
          etiquetaDeCarga="Cargando tus tarjetas"
          cargando={cargando}
          fallo={fallo}
          onReintentar={recargar}
        >
          {items.length === 0 ? (
            <Text variant="muted" className="py-4 text-center">
              Todavía no tienes tarjetas. Agrega la primera para continuar.
            </Text>
          ) : (
            items.map((tarjeta) => (
              <FilaDeLista
                key={tarjeta.id}
                titulo={tarjeta.nombre}
                detalle={textoDeTasa(tarjeta.tasaEA)}
                onPress={() => onElegir(tarjeta)}
              />
            ))
          )}
          <BotonAgregar texto="+ Agregar tarjeta" onPress={() => setCreando(true)} />
        </EstadoDeLista>
      </ScrollView>
      <Button variant="outline" className="h-[50px] w-full" onPress={onAtras}>
        <Text className="font-semibold">Atrás</Text>
      </Button>
      {creando ? (
        <HojaTarjeta tarjeta={null} onCerrar={() => setCreando(false)} onCambio={recargar} />
      ) : null}
    </View>
  );
}
