import { apiClient, setToken } from '@/api/client';
import type { AuthResponse, LoginPayload, SignupPayload, User } from '@/types';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/auth/me');
}

/** Save token after successful auth */
export function persistToken(token: string): void {
  setToken(token);
}
