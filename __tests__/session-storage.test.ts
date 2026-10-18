import { sessionStorage as nativo } from '@/lib/session-storage';
import { sessionStorage as web } from '@/lib/session-storage.web';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('almacenamiento de sesión nativo', () => {
  it('guarda, lee y borra en el almacén seguro con la misma clave', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('valor');

    await nativo.set('valor');
    await expect(nativo.get()).resolves.toBe('valor');
    await nativo.remove();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('aequo.sesion', 'valor');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('aequo.sesion');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('aequo.sesion');
  });
});

describe('almacenamiento de sesión web', () => {
  const datos = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k: string) => datos.get(k) ?? null,
          setItem: (k: string, v: string) => datos.set(k, v),
          removeItem: (k: string) => datos.delete(k),
        },
      },
    });
  });

  it('guarda, lee y borra en localStorage', async () => {
    await expect(web.get()).resolves.toBeNull();
    await web.set('valor');
    await expect(web.get()).resolves.toBe('valor');
    await web.remove();
    await expect(web.get()).resolves.toBeNull();
  });
});
