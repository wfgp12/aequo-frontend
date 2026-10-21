import { ApiError, request, type OpcionesDeRequest } from './client';

// Puente entre el Adapter (funciones sueltas) y la sesión (React): SessionProvider registra aquí
// cómo leer el token y qué hacer cuando el backend rechaza la sesión.
type ManejadorDeSesion = {
  obtenerSesion: () => { accessToken: string; expiraEn: number } | null;
  alRechazarSesion: () => void;
};

let manejador: ManejadorDeSesion | null = null;

/** Registra el manejador y devuelve la función que lo quita, solo si sigue siendo el vigente. */
export function registrarManejadorDeSesion(nuevo: ManejadorDeSesion | null) {
  manejador = nuevo;
  return () => {
    if (manejador === nuevo) manejador = null;
  };
}

/**
 * Llamada a una ruta protegida del backend: adjunta Authorization: Bearer con el JWT de la sesión.
 * Ante un 401 (sin token, vencido o manipulado: el backend no distingue el motivo) cierra la sesión local,
 * y la app vuelve al login. Si la sesión ya venció localmente, ni siquiera llama al backend.
 */
export async function requestAutenticado<T>(
  path: string,
  opciones: Omit<OpcionesDeRequest, 'token'> = {},
): Promise<T> {
  const sesion = manejador?.obtenerSesion();
  if (!sesion || sesion.expiraEn <= Date.now()) {
    manejador?.alRechazarSesion();
    throw new ApiError(401, 'Sesión inválida o vencida');
  }
  try {
    return await request<T>(path, { ...opciones, token: sesion.accessToken });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) manejador?.alRechazarSesion();
    throw e;
  }
}
