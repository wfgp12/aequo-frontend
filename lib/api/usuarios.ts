import type { Usuario } from './auth';
import { requestAutenticado } from './autenticado';

/** GET /usuarios/me: devuelve solo los datos del usuario de la sesión (id, nombre, email y fotoUrl). */
export function obtenerPerfil() {
  return requestAutenticado<Usuario>('/usuarios/me');
}

/**
 * DELETE /usuarios/me: elimina la cuenta y toda su información, de forma inmediata y permanente (responde 204).
 * Es idempotente: si falla a mitad (500) se puede repetir la misma petición.
 */
export function eliminarCuenta() {
  return requestAutenticado<void>('/usuarios/me', { method: 'DELETE' });
}
