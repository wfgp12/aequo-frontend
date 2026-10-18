import { signInWithGoogle } from '@/lib/google-sign-in';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithCredential } from 'firebase/auth';

jest.mock('@/lib/firebase', () => ({ auth: { nombre: 'auth' } }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: jest.fn((token: string) => ({ token })) },
  signInWithCredential: jest.fn(),
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));

describe('signInWithGoogle (nativo)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('canjea el token de Google en Firebase y devuelve el ID Token de Firebase', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: { idToken: 'token-google' },
    } as never);
    jest.mocked(signInWithCredential).mockResolvedValue({
      user: { getIdToken: async () => 'id-token-firebase' },
    } as never);

    await expect(signInWithGoogle()).resolves.toBe('id-token-firebase');
    expect(GoogleSignin.configure).toHaveBeenCalled();
    expect(signInWithCredential).toHaveBeenCalledWith(
      { nombre: 'auth' },
      { token: 'token-google' },
    );
  });

  it('devuelve null si el usuario cancela', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'cancelled', data: null } as never);
    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('devuelve null si Google no entrega idToken', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'success', data: {} } as never);
    await expect(signInWithGoogle()).resolves.toBeNull();
  });
});
