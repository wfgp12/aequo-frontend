import Home from '@/app/index';
import { fireEvent, render, screen } from '@testing-library/react-native';

// El acceso a los préstamos desde el inicio (criterios/06-prestamos.md, CA-RF34-F01). Mismo armado que
// home.test.tsx.
const mockIr = jest.fn();

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

describe('Inicio: préstamos', () => {
  it('CA-RF34-F01 el botón "Préstamos" lleva a /prestamos y los dos botones de registro siguen igual', async () => {
    await render(<Home />);

    expect(screen.getByRole('button', { name: 'Registrar ingreso' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Registrar egreso' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Registrar / })).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Préstamos' }));

    expect(mockIr).toHaveBeenCalledWith('/prestamos');
  });
});
