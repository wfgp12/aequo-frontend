import { request } from './client';

export type Usuario = { id: string; nombre: string; email: string; fotoUrl: string | null };

export type RespuestaLogin = {
  accessToken: string;
  /** Vigencia del accessToken en segundos (24 h, RNF-01). */
  expiresIn: number;
  usuario: Usuario;
};

/** POST /auth/login: el backend verifica el ID Token de Firebase una sola vez y emite su propio JWT. */
export function login(idToken: string) {
  return request<RespuestaLogin>('/auth/login', { method: 'POST', body: { idToken } });
}

/** POST /auth/dev-login: sesión de un usuario de prueba. Solo existe en un backend de desarrollo; en cualquier otro responde 404. */
export function loginDeDesarrollo() {
  return request<RespuestaLogin>('/auth/dev-login', { method: 'POST' });
}
