import type { ApiErrorBody } from '@/types';

const TOKEN_KEY = 'brightloop_token';

/**
 * Custom error class that carries the structured API error payload.
 */
export class ApiError extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

/** Read the JWT from localStorage */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store the JWT */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Clear the JWT */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Core fetch wrapper:
 * - Attaches Authorization header when a token exists
 * - Parses the standard { error: { code, message, fields } } format
 * - On 401, clears session and redirects to /login
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Try to parse JSON body
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, {
        code: 'NETWORK_ERROR',
        message: `Request failed with status ${response.status}`,
      });
    }
    return undefined as T;
  }

  // Handle error responses
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;

    // On 401, clear session and redirect to login
    if (response.status === 401) {
      clearToken();
      window.location.href = '/login';
      throw new ApiError(401, {
        code: 'UNAUTHORIZED',
        message: 'Session expired. Please log in again.',
      });
    }

    if (errorBody?.error) {
      throw new ApiError(response.status, errorBody.error);
    }

    throw new ApiError(response.status, {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
    });
  }

  return body as T;
}
