/**
 * Unit tests for the API client — the module that must speak
 * docs/api-contract.md exactly: JSON bodies, bearer tokens, and the
 * { error: { code, message, fields } } error envelope.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from './client';

// browser globals stubbed — the client uses localStorage + window.location
const store = new Map<string, string>();
const locationStub = { href: '' };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { location: locationStub });

const { apiClient, ApiError: ApiErrorClass, getToken, setToken, clearToken } = await import('./client');
const { login, signup, getMe, persistToken } = await import('./auth');

beforeEach(() => {
  store.clear();
  locationStub.href = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(payload: {
  ok: boolean;
  status?: number;
  statusText?: string;
  jsonBody?: unknown;
  jsonThrows?: boolean;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: payload.ok,
    status: payload.status ?? 200,
    statusText: payload.statusText ?? '',
    json: () =>
      payload.jsonThrows ? Promise.reject(new Error('not json')) : Promise.resolve(payload.jsonBody),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('token storage', () => {
  it('round-trips a token and clears it', () => {
    expect(getToken()).toBeNull();
    setToken('tok-123');
    expect(getToken()).toBe('tok-123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('persistToken stores the auth token', () => {
    persistToken('jwt-abc');
    expect(getToken()).toBe('jwt-abc');
  });
});

describe('apiClient — happy path', () => {
  it('sends JSON with the bearer header and returns parsed data', async () => {
    setToken('tok-123');
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { items: [1, 2] } });

    const data = await apiClient<{ items: number[] }>('/invoices?page=1');

    expect(data).toEqual({ items: [1, 2] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/invoices?page=1'); // VITE_API_BASE_URL from .env
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when logged out', async () => {
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: {} });
    await apiClient('/health');
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const data = await apiClient('/anything', { method: 'DELETE' });
    expect(data).toBeUndefined();
  });
});

describe('apiClient — contract error envelope', () => {
  it('normalizes {error:{code,message,fields}} into ApiError', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      jsonBody: { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: { email: 'Already in use' } } },
    });

    const err = (await apiClient('/auth/signup', { method: 'POST', body: '{}' }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiErrorClass);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
    expect(err.fields).toEqual({ email: 'Already in use' });
  });

  it('falls back to a network error shape when the body is not JSON', async () => {
    mockFetchOnce({ ok: false, status: 502, statusText: 'Bad Gateway', jsonThrows: true });

    const err = (await apiClient('/anything').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiErrorClass);
    expect(err.status).toBe(502);
    expect(err.message).toContain('502');
  });

  it('clears the session and redirects to /login on 401', async () => {
    setToken('expired-token');
    mockFetchOnce({
      ok: false,
      status: 401,
      jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
    });

    const err = (await apiClient('/auth/me').catch((e) => e)) as ApiError;
    expect(err.status).toBe(401);
    expect(getToken()).toBeNull(); // session cleared
    expect(locationStub.href).toBe('/login'); // redirected
  });
});

describe('auth helpers', () => {
  it('login posts credentials and returns the auth response (token + user)', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: { token: 'jwt-abc', access_token: 'jwt-abc', user: { id: 2, role: 'staff', customerId: null } },
    });

    const res = await login({ email: 'staff@x.test', password: 'Passw0rd!' });

    expect(res.token).toBe('jwt-abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'staff@x.test', password: 'Passw0rd!' });
    // client design: auth helpers RETURN the token; the page persists it
    expect(getToken()).toBeNull();
  });

  it('signup posts name/email/password', async () => {
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { token: 't', user: { id: 2 } } });
    await signup({ name: 'New User', email: 'new@x.test', password: 'GoodPass1!' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/auth/signup');
    expect(JSON.parse(init.body)).toEqual({ name: 'New User', email: 'new@x.test', password: 'GoodPass1!' });
  });

  it('me() sends the bearer token', async () => {
    setToken('jwt-xyz');
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { id: 1, role: 'admin' } });
    await getMe();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/auth/me');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-xyz');
  });
});
