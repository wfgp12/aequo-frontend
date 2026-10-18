import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { login, type Usuario } from './api/auth';
import { auth } from './firebase';
import { signInWithGoogle } from './google-sign-in';
import { sessionStorage } from './session-storage';

// La sesión es el JWT propio del backend (ADR-007); el ID Token de Firebase solo se usa en el login.
type Sesion = { accessToken: string; expiraEn: number; usuario: Usuario };

type Estado = 'cargando' | 'sin-sesion' | 'activa';

type SessionContext = {
  estado: Estado;
  sesion: Sesion | null;
  /** Abre el login de Google y crea la sesión. Devuelve false si el usuario cancela. */
  iniciarSesion: () => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
};

const Context = createContext<SessionContext | null>(null);

async function leerSesionGuardada(): Promise<Sesion | null> {
  try {
    const guardada = await sessionStorage.get();
    const sesion = guardada ? (JSON.parse(guardada) as Sesion) : null;
    if (sesion && sesion.expiraEn > Date.now()) return sesion;
  } catch {
    // almacenamiento ilegible: se trata como sin sesión
  }
  await sessionStorage.remove().catch(() => undefined);
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    // leerSesionGuardada nunca rechaza: ante cualquier fallo devuelve null
    void leerSesionGuardada().then((s) => {
      setSesion(s);
      setEstado(s ? 'activa' : 'sin-sesion');
    });
  }, []);

  const iniciarSesion = useCallback(async () => {
    const idToken = await signInWithGoogle();
    if (!idToken) return false;
    const { accessToken, expiresIn, usuario } = await login(idToken);
    const nueva: Sesion = { accessToken, usuario, expiraEn: Date.now() + expiresIn * 1000 };
    await sessionStorage.set(JSON.stringify(nueva));
    setSesion(nueva);
    setEstado('activa');
    return true;
  }, []);

  const cerrarSesion = useCallback(async () => {
    // Cerrar sesión siempre debe completarse, aunque el almacenamiento falle
    await sessionStorage.remove().catch(() => undefined);
    await auth.signOut().catch(() => undefined);
    setSesion(null);
    setEstado('sin-sesion');
  }, []);

  const valor = useMemo(
    () => ({ estado, sesion, iniciarSesion, cerrarSesion }),
    [estado, sesion, iniciarSesion, cerrarSesion],
  );

  return <Context.Provider value={valor}>{children}</Context.Provider>;
}

export function useSession() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
