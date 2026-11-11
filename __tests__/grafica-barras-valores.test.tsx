import { GraficaBarras } from '@/components/graficas/grafica-barras';
import { render, screen } from '@testing-library/react-native';

// Lo nuevo de GraficaBarras en 3.2.2 (criterios/03-reportes-ingresos-egresos.md, CA-RF17-28): el valor en pesos
// va sobre cada barra. La librería se simula en su borde: cada punto que recibe puede traer su `topLabelComponent`
// (el rótulo sobre la barra) y aquí se dibuja junto a su etiqueta, para ver lo que vería el usuario.
jest.mock('react-native-gifted-charts', () => {
  const { Text, View } = require('react-native');
  return {
    BarChart: (props: any) => (
      <>
        {props.data.map((d: any, i: number) => (
          <View key={i}>
            {d.topLabelComponent ? d.topLabelComponent() : null}
            <Text>{d.label}</Text>
          </View>
        ))}
      </>
    ),
  };
});
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 1, fontScale: 1 }),
}));

describe('GraficaBarras: valor sobre cada barra', () => {
  it('CA-RF17-28 muestra sobre cada barra su valor en pesos, con puntos de miles y sin decimales', async () => {
    await render(
      <GraficaBarras
        descripcion="Ingresos y egresos"
        datos={[
          { etiqueta: 'Ingresos', valor: 3400000 },
          { etiqueta: 'Egresos', valor: 2150000.6 },
        ]}
      />,
    );

    expect(screen.getByText('$3.400.000')).toBeOnTheScreen();
    expect(screen.getByText('$2.150.001')).toBeOnTheScreen();
    expect(screen.getByText('Ingresos')).toBeOnTheScreen();
    expect(screen.getByText('Egresos')).toBeOnTheScreen();
  });

  it('CA-RF17-28 un valor en cero se ve como $0, sin NaN', async () => {
    await render(
      <GraficaBarras
        descripcion="Ingresos y egresos"
        datos={[
          { etiqueta: 'Ingresos', valor: 0 },
          { etiqueta: 'Egresos', valor: 500000 },
        ]}
      />,
    );

    expect(screen.getByText('$0')).toBeOnTheScreen();
    expect(screen.getByText('$500.000')).toBeOnTheScreen();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
