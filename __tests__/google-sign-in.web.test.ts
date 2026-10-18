import { signInWithGoogle } from '@/lib/google-sign-in.web';
import { signInWithPopup } from 'firebase/auth';

jest.mock('@/lib/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}));

describe('signInWithGoogle (web)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devuelve el ID Token de Firebase tras la ventana emergente', async () => {
    jest.mocked(signInWithPopup).mockResolvedValue({
      user: { getIdToken: async () => 'id-token-firebase' },
    } as never);
    await expect(signInWithGoogle()).resolves.toBe('id-token-firebase');
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'devuelve null cuando el usuario cierra la ventana (%s)',
    async (code) => {
      jest.mocked(signInWithPopup).mockRejectedValue({ code });
      await expect(signInWithGoogle()).resolves.toBeNull();
    },
  );

  it('relanza cualquier otro error', async () => {
    jest.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(signInWithGoogle()).rejects.toEqual({ code: 'auth/network-request-failed' });
  });
});
