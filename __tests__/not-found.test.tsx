import NotFound from '@/app/+not-found';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('NotFound', () => {
  it('avisa que la pantalla no existe y ofrece volver al inicio', async () => {
    await render(<NotFound />);
    expect(screen.getByText('Esta pantalla no existe.')).toBeOnTheScreen();
    expect(screen.getByText('Volver al inicio')).toBeOnTheScreen();
  });
});
