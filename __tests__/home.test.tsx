import Home from '@/app/index';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockIr = jest.fn();

// Como con `asChild`, el Link le da al botón el toque que lleva a su ruta
jest.mock('expo-router', () => {
  const { cloneElement } = require('react');
  return {
    Link: ({ children, href }: { children: React.ReactElement<any>; href: unknown }) =>
      cloneElement(children, { onPress: () => mockIr(href) }),
  };
});
jest.mock('@/lib/session', () => ({
  useSession: () => ({ sesion: { usuario: { nombre: 'Ana' } } }),
}));

describe('Home', () => {
  it('saluda al usuario con la sesión activa', async () => {
    await render(<Home />);
    expect(screen.getByText('Aequo')).toBeOnTheScreen();
    expect(screen.getByText('Hola, Ana')).toBeOnTheScreen();
  });

  it('ofrece el acceso al perfil', async () => {
    await render(<Home />);
    expect(screen.getByText('Mi perfil')).toBeOnTheScreen();
  });

  it('CA-RF20-01 ofrece el botón "Reportes", junto a "Movimientos" y "Mi perfil", que lleva a /reportes', async () => {
    mockIr.mockClear();
    await render(<Home />);

    expect(screen.getByRole('button', { name: 'Movimientos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mi perfil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reportes' }));

    expect(mockIr).toHaveBeenCalledWith('/reportes');
  });

  it('CA-RF21-F01 ofrece el botón "Meta de ahorro", junto a "Movimientos", "Reportes" y "Mi perfil", que lleva a /meta-de-ahorro', async () => {
    mockIr.mockClear();
    await render(<Home />);

    expect(screen.getByRole('button', { name: 'Movimientos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mi perfil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Meta de ahorro' }));

    expect(mockIr).toHaveBeenCalledWith('/meta-de-ahorro');
  });
});
