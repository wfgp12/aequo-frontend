import type { Usuario } from './auth';
import { requestAutenticado } from './autenticado';

/** GET /usuarios/me: devuelve solo los datos del usuario de la sesión (id, nombre, email y fotoUrl). */
export function obtenerPerfil() {
  return requestAutenticado<Usuario>('/usuarios/me');
}
