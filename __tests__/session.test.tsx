import { login } from '@/lib/api/auth';
import { signInWithGoogle } from '@/lib/google-sign-in';
import { SessionProvider, useSession } from '@/lib/session';
import { sessionStorage } from '@/lib/session-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('@/lib/firebase', () => ({
  auth: { signOut: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/lib/google-sign-in', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/lib/api/auth', () => ({ login: jest.fn() }));
jest.mock('@/lib/session-storage', () => ({
  sessionStorage: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

const storage = jest.mocked(sessionStorage);
const usuario = { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', fotoUrl: null };
const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

function guardada(expiraEn: number) {
  return JSON.stringify({ accessToken: 'jwt', usuario, expiraEn });
}

async function montar() {
  const hook = await renderHook(() => useSession(), { wrapper });
  await waitFor(() => expect(hook.result.current.estado).not.toBe('cargando'));
  return hook;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.get.mockResolvedValue(null);
    storage.set.mockResolvedValue(undefined);
    storage.remove.mockResolvedValue(undefined);
  });

  it('queda sin sesión si no hay nada guardado', async () => {
    const { result } = await montar();
    expect(result.current.estado).toBe('sin-sesion');
    expect(result.current.sesion).toBeNull();
  });

  it('restaura una sesión guardada y vigente', async () => {
    storage.get.mockResolvedValue(guardada(Date.now() + 60_000));
    const { result } = await montar();
    expect(result.current.estado).toBe('activa');
    expect(result.current.sesion?.usuario.nombre).toBe('Ana');
  });

  it('descarta una sesión vencida', async () => {
    storage.get.mockResolvedValue(guardada(Date.now() - 1));
    const { result } = await montar();
    expect(result.current.estado).toBe('sin-sesion');
    expect(storage.remove).toHaveBeenCalled();
  });

  it('descarta un almacenamiento corrupto', async () => {
    storage.get.mockResolvedValue('no es json');
    const { result } = await montar();
    expect(result.current.estado).toBe('sin-sesion');
  });

  it('inicia sesión: canjea el ID Token, guarda el JWT y activa la sesión', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue('id-token');
    jest.mocked(login).mockResolvedValue({ accessToken: 'jwt', expiresIn: 86400, usuario });
    const { result } = await montar();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.iniciarSesion();
    });

    expect(ok).toBe(true);
    expect(login).toHaveBeenCalledWith('id-token');
    expect(JSON.parse(storage.set.mock.calls[0][0]).accessToken).toBe('jwt');
    expect(result.current.estado).toBe('activa');
  });

  it('no hace nada si el usuario cancela el login de Google', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue(null);
    const { result } = await montar();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.iniciarSesion();
    });

    expect(ok).toBe(false);
    expect(login).not.toHaveBeenCalled();
    expect(result.current.estado).toBe('sin-sesion');
  });

  it('deja la sesión sin activar si el backend rechaza el token', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue('malo');
    jest.mocked(login).mockRejectedValue(new Error('401'));
    const { result } = await montar();

    await act(async () => {
      await expect(result.current.iniciarSesion()).rejects.toThrow('401');
    });

    expect(storage.set).not.toHaveBeenCalled();
    expect(result.current.estado).toBe('sin-sesion');
  });

  it('cierra la sesión y limpia lo guardado', async () => {
    storage.get.mockResolvedValue(guardada(Date.now() + 60_000));
    const { result } = await montar();

    await act(async () => {
      await result.current.cerrarSesion();
    });

    expect(storage.remove).toHaveBeenCalled();
    expect(result.current.estado).toBe('sin-sesion');
    expect(result.current.sesion).toBeNull();
  });
});
