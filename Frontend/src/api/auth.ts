import { apiClient, setToken, getToken } from '@/api/client';
import { mockHandlers, isMockEnabled } from '@/api/mocks';
import type { AuthResponse, LoginPayload, SignupPayload, User } from '@/types';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  if (isMockEnabled()) {
    return mockHandlers.login(payload);
  }
  return apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  if (isMockEnabled()) {
    return mockHandlers.signup(payload);
  }
  return apiClient<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<User> {
  if (isMockEnabled()) {
    const token = getToken();
    if (!token) {
      throw new Error('No token');
    }
    return mockHandlers.me(token);
  }
  return apiClient<User>('/auth/me');
}

/** Save token after successful auth */
export function persistToken(token: string): void {
  setToken(token);
}
