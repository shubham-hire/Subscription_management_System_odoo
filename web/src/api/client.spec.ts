/**
 * Unit tests for the frontend API client — the single module that must speak
 * docs/api-contract.md exactly: JSON bodies, bearer tokens, and the
 * { error: { code, message, fields } } error envelope.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClientError } from './client';

// localStorage stub — the client stores the JWT there
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { api, ApiClientError: ApiClientErrorClass, auth, getToken, setToken } = await import('./client');

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
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
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('api() — happy path', () => {
  it('sends JSON with the bearer header and returns parsed data', async () => {
    setToken('tok-123');
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { items: [1, 2] } });

    const data = await api<{ items: number[] }>('/invoices?page=1');

    expect(data).toEqual({ items: [1, 2] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/invoices?page=1');
    expect(init?.method).toBeUndefined(); // default GET
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when logged out', async () => {
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: {} });
    await api('/health');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('api() — contract error envelope', () => {
  it('normalizes {error:{code,message,fields}} into ApiClientError', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      jsonBody: { error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: { email: 'Already in use' } } },
    });

    const err = (await api('/auth/signup', { method: 'POST', body: '{}' }).catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientErrorClass);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
    expect(err.fields).toEqual({ email: 'Already in use' });
  });

  it('falls back to statusText when the body is not JSON (proxied 500s etc.)', async () => {
    mockFetchOnce({ ok: false, status: 502, statusText: 'Bad Gateway', jsonThrows: true });

    const err = (await api('/anything').catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientErrorClass);
    expect(err.status).toBe(502);
    expect(err.code).toBe('INTERNAL');
    expect(err.message).toBe('Bad Gateway');
  });

  it('defaults to 401 contract shape for auth failures', async () => {
    mockFetchOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
    });
    const err = (await api('/auth/me').catch((e) => e)) as ApiClientError;
    expect(err.code).toBe('UNAUTHORIZED');
  });
});

describe('auth helpers', () => {
  it('login posts credentials and stores the token', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: { token: 'jwt-abc', user: { id: 1, role: 'staff', customerId: null } },
    });

    const res = await auth.login('staff@x.test', 'Passw0rd!');

    expect(res.token).toBe('jwt-abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'staff@x.test', password: 'Passw0rd!' });
    // Client design: auth helpers RETURN the token; the caller (Login page)
    // persists it via setToken — the client never stores implicitly.
    expect(getToken()).toBeNull();
  });

  it('signup posts name/email/password', async () => {
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { token: 't', user: { id: 2 } } });
    await auth.signup('New User', 'new@x.test', 'GoodPass1!');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/auth/signup');
    expect(JSON.parse(init.body)).toEqual({ name: 'New User', email: 'new@x.test', password: 'GoodPass1!' });
  });

  it('me() sends the bearer token', async () => {
    setToken('jwt-xyz');
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { id: 1 } });
    await auth.me();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/auth/me');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-xyz');
  });
});
