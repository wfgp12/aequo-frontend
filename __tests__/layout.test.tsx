import RootLayout from '@/app/_layout';
import { render, screen } from '@testing-library/react-native';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    ErrorBoundary: () => null,
    Stack: () => <Text>pantalla</Text>,
  };
});

describe('RootLayout', () => {
  it('renderiza la pila de pantallas dentro del tema', async () => {
    await render(<RootLayout />);
    expect(screen.getByText('pantalla')).toBeOnTheScreen();
  });
});
