const KEY = 'aequo.sesion';

// ponytail: localStorage en web (no hay almacén seguro); la sesión dura 24 h. Si se vuelve un riesgo, mover a cookie httpOnly desde el backend.
export const sessionStorage = {
  get: async () => window.localStorage.getItem(KEY),
  set: async (value: string) => window.localStorage.setItem(KEY, value),
  remove: async () => window.localStorage.removeItem(KEY),
};
