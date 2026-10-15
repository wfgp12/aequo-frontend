import Home from '@/app/index';
import { fireEvent, render, screen } from '@testing-library/react-native';

describe('Home', () => {
  it('muestra el nombre y el lema', async () => {
    await render(<Home />);
    expect(screen.getByText('Aequo')).toBeOnTheScreen();
    expect(screen.getByText('El equilibrio de tus finanzas personales')).toBeOnTheScreen();
  });

  it('cuenta los toques del botón', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByText('Tocaste 0 veces'));
    expect(screen.getByText('Tocaste 1 veces')).toBeOnTheScreen();
  });
});
