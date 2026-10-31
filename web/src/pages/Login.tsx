import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError, auth, setToken } from '../api/client';

/**
 * Login + Signup in one screen (mode toggle) — matches PRD acceptance #1:
 * weak password shows which rule failed (server field errors render inline).
 */
export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const { token } =
        mode === 'login'
          ? await auth.login(form.email, form.password)
          : await auth.signup(form.name, form.email, form.password);
      setToken(token);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError('Cannot reach the server');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-gray-900">
          Brightloop <span className="text-indigo-600">SMS</span>
        </h1>
        <p className="text-sm text-gray-500">
          {mode === 'login' ? 'Sign in to your account' : 'Create a customer account'}
        </p>

        {mode === 'signup' && (
          <Field label="Name" value={form.name} onChange={set('name')} error={fieldErrors['name']} />
        )}
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          error={fieldErrors['email']}
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={set('password')}
          error={fieldErrors['password']}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="w-full text-sm text-indigo-600 hover:underline"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        {...props}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          error ? 'border-red-400' : 'border-gray-300'
        } focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
