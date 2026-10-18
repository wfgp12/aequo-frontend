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
