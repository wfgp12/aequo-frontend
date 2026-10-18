import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Android nativo: inicio de sesión de Google y canje del token en Firebase.
 * Devuelve el ID Token de Firebase, o null si el usuario cancela.
 * El módulo nativo se importa aquí adentro porque Expo Go no lo incluye: así la app arranca igual en el iPhone.
 */
export async function signInWithGoogle(): Promise<string | null> {
  // require perezoso: Metro lo evalúa solo al llamar la función, no al arrancar la app
  const { GoogleSignin } =
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  if (res.type !== 'success' || !res.data.idToken) return null;
  const { user } = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(res.data.idToken),
  );
  return user.getIdToken();
}
