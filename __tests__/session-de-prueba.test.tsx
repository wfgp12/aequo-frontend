import { loginDeDesarrollo } from '@/lib/api/auth';
import { sesionDePruebaDisponible } from '@/lib/dev-session';
import { SessionProvider, useSession } from '@/lib/session';
import { sessionStorage } from '@/lib/session-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('@/lib/firebase', () => ({
  auth: { signOut: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/google-sign-in', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/lib/api/auth', () => ({ login: jest.fn(), loginDeDesarrollo: jest.fn() }));
jest.mock('@/lib/dev-session', () => ({ sesionDePruebaDisponible: jest.fn() }));
jest.mock('@/lib/session-storage', () => ({
  sessionStorage: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

const storage = jest.mocked(sessionStorage);
const usuario = {
  id: 'u1',
  nombre: 'Usuario de prueba',
  email: 'prueba@aequo.local',
  fotoUrl: null,
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

async function montar() {
  const hook = await renderHook(() => useSession(), { wrapper });
  await waitFor(() => expect(hook.result.current.estado).not.toBe('cargando'));
  return hook;
}

describe('sesión de prueba (solo desarrollo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.get.mockResolvedValue(null);
    storage.set.mockResolvedValue(undefined);
    storage.remove.mockResolvedValue(undefined);
  });

  it('en desarrollo abre la sesión con el usuario de prueba y la guarda', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    jest
      .mocked(loginDeDesarrollo)
      .mockResolvedValue({ accessToken: 'jwt-prueba', expiresIn: 86400, usuario });
    const { result } = await montar();

    await act(async () => {
      await result.current.iniciarSesionDePrueba();
    });

    expect(result.current.estado).toBe('activa');
    expect(result.current.sesion?.usuario.nombre).toBe('Usuario de prueba');
    expect(JSON.parse(storage.set.mock.calls[0][0]).accessToken).toBe('jwt-prueba');
  });

  it('en producción se rechaza y nunca llama al backend', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(false);
    const { result } = await montar();

    await act(async () => {
      await expect(result.current.iniciarSesionDePrueba()).rejects.toThrow(/solo está disponible/);
    });

    expect(loginDeDesarrollo).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(result.current.estado).toBe('sin-sesion');
  });

  it('si el backend responde 404 la sesión no se abre', async () => {
    jest.mocked(sesionDePruebaDisponible).mockReturnValue(true);
    jest.mocked(loginDeDesarrollo).mockRejectedValue(new Error('404'));
    const { result } = await montar();

    await act(async () => {
      await expect(result.current.iniciarSesionDePrueba()).rejects.toThrow('404');
    });

    expect(result.current.estado).toBe('sin-sesion');
  });
});
