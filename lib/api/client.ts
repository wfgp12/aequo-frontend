// Cliente HTTP base del Adapter: todas las llamadas al backend pasan por aquí.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Error de respuesta del backend (formato estándar de NestJS). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Error de red: el backend no respondió. */
export class NetworkError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor');
    this.name = 'NetworkError';
  }
}

type Opciones = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
};

export async function request<T>(
  path: string,
  { method = 'GET', body, token }: Opciones = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // message llega como string, o como string[] en los 400 de validación
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(res.status, message ?? res.statusText);
  }
  return data as T;
}
