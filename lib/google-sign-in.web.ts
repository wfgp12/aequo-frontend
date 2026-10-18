import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

/** Web: ventana emergente de Google a través de Firebase. Devuelve el ID Token de Firebase, o null si se cancela. */
export async function signInWithGoogle(): Promise<string | null> {
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    return await user.getIdToken();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
      return null;
    throw e;
  }
}
