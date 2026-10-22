import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { registrarManejadorDeSesion } from './api/autenticado';
import { login, loginDeDesarrollo, type RespuestaLogin, type Usuario } from './api/auth';
import { sesionDePruebaDisponible } from './dev-session';
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
  /** Solo en desarrollo: entra con el usuario de prueba del backend (para Expo Go, donde no hay login de Google). */
  iniciarSesionDePrueba: () => Promise<void>;
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

  const abrirSesion = useCallback(async ({ accessToken, expiresIn, usuario }: RespuestaLogin) => {
    const nueva: Sesion = { accessToken, usuario, expiraEn: Date.now() + expiresIn * 1000 };
    await sessionStorage.set(JSON.stringify(nueva));
    setSesion(nueva);
    setEstado('activa');
  }, []);

  const iniciarSesion = useCallback(async () => {
    const idToken = await signInWithGoogle();
    if (!idToken) return false;
    await abrirSesion(await login(idToken));
    return true;
  }, [abrirSesion]);

  const iniciarSesionDePrueba = useCallback(async () => {
    // Doble guarda: aunque la interfaz no muestre el botón, fuera de desarrollo nunca se llama al backend
    if (!sesionDePruebaDisponible()) {
      throw new Error('La sesión de prueba solo está disponible en desarrollo');
    }
    await abrirSesion(await loginDeDesarrollo());
  }, [abrirSesion]);

  const cerrarSesion = useCallback(async () => {
    // Cerrar sesión siempre debe completarse, aunque el almacenamiento falle
    await sessionStorage.remove().catch(() => undefined);
    await auth.signOut().catch(() => undefined);
    setSesion(null);
    setEstado('sin-sesion');
  }, []);

  // Las llamadas autenticadas del Adapter leen la sesión actual y cierran la sesión si el backend la rechaza (401)
  const sesionActual = useRef<Sesion | null>(null);
  sesionActual.current = sesion;
  useEffect(() => {
    return registrarManejadorDeSesion({
      obtenerSesion: () => sesionActual.current,
      alRechazarSesion: () => {
        void cerrarSesion();
      },
    });
  }, [cerrarSesion]);

  // La sesión dura 24 h (RNF-01): al vencer, la app cierra la sesión sola y vuelve al login
  useEffect(() => {
    if (!sesion) return;
    const temporizador = setTimeout(
      () => {
        void cerrarSesion();
      },
      Math.max(sesion.expiraEn - Date.now(), 0),
    );
    return () => clearTimeout(temporizador);
  }, [sesion, cerrarSesion]);

  const valor = useMemo(
    () => ({ estado, sesion, iniciarSesion, iniciarSesionDePrueba, cerrarSesion }),
    [estado, sesion, iniciarSesion, iniciarSesionDePrueba, cerrarSesion],
  );

  return <Context.Provider value={valor}>{children}</Context.Provider>;
}

export function useSession() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
