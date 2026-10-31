/**
 * API client — Dev C extends this. Error shape matches docs/api-contract.md:
 * every failure throws ApiClientError { code, message, fields }.
 */
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  code: string;
  fields?: Record<string, string>;
  status: number;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('bl_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('bl_token', token);
  else localStorage.removeItem('bl_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let code = 'INTERNAL';
    let message = res.statusText;
    let fields: Record<string, string> | undefined;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
      fields = body?.error?.fields;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(res.status, code, message, fields);
  }
  return res.json() as Promise<T>;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'customer';
  customer_id: number | null;
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signup: (name: string, email: string, password: string) =>
    api<{ token: string; user: AuthUser }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  me: () => api<AuthUser>('/auth/me'),
};
