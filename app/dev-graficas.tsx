import { GraficaBarras } from '@/components/graficas/grafica-barras';
import { GraficaDona } from '@/components/graficas/grafica-dona';
import { GraficaLinea } from '@/components/graficas/grafica-linea';
import { Text } from '@/components/ui/text';
import { ScrollView, View } from 'react-native';

// Pantalla SOLO de desarrollo (paquete 3.2.1): el layout la registra únicamente con __DEV__.
// Sirve para revisar las tres gráficas en web, Expo Go y Android, en modo claro y oscuro. Datos de ejemplo fijos.
const MESES = [
  { etiqueta: 'Ene', valor: 1200000 },
  { etiqueta: 'Feb', valor: 950000 },
  { etiqueta: 'Mar', valor: 1800000 },
  { etiqueta: 'Abr', valor: 700000 },
  { etiqueta: 'May', valor: 1500000 },
  { etiqueta: 'Jun', valor: 2100000 },
];
const CATEGORIAS = [
  { etiqueta: 'Comida', valor: 650000 },
  { etiqueta: 'Transporte', valor: 320000 },
  { etiqueta: 'Arriendo', valor: 1200000 },
  { etiqueta: 'Otros', valor: 180000 },
];

export default function DevGraficas() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-8 p-6">
      <Text variant="h3">Gráficas de prueba</Text>
      <View className="gap-3">
        <Text variant="large">Barras</Text>
        <GraficaBarras datos={MESES} descripcion="Egresos por mes, de enero a junio" />
      </View>
      <View className="gap-3">
        <Text variant="large">Dona</Text>
        <GraficaDona
          datos={CATEGORIAS}
          centro="$2.350.000"
          descripcion="Egresos por categoría del mes"
        />
      </View>
      <View className="gap-3">
        <Text variant="large">Línea</Text>
        <GraficaLinea datos={MESES} descripcion="Egresos por mes, de enero a junio" />
      </View>
    </ScrollView>
  );
}
