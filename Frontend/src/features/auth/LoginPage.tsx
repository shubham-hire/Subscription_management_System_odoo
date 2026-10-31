import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginFormValues } from '@/lib/schemas';
import { login, persistToken } from '@/api/auth';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/api/client';
import { Button, Field, Input } from '@/components/ui';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@brightloop.dev', password: 'Admin@1234' },
  { role: 'Staff', email: 'staff@brightloop.dev', password: 'Staff@1234' },
  { role: 'Customer', email: 'customer@brightloop.dev', password: 'Customer@1234' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const res = await login(data);
      persistToken(res.access_token);
      setUser(res.user);

      if (res.user.role === 'customer') {
        navigate('/portal', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          Object.entries(err.fields).forEach(([field, message]) => {
            setError(field as keyof LoginFormValues, { message });
          });
        } else {
          setError('root', { message: err.message });
        }
      } else {
        setError('root', { message: 'An unexpected error occurred.' });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Ambient glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/15 blur-[120px]"
      />

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl btn-gradient items-center justify-center mb-4 shadow-glow">
            <span className="text-white font-bold text-heading">B</span>
          </div>
          <h1 className="text-heading text-zinc-100">
            Welcome to <span className="text-gradient">Brightloop</span>
          </h1>
          <p className="mt-1 text-body text-zinc-500">
            Sign in to manage your subscriptions
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="glass glass-edge shadow-card p-6 space-y-4"
          noValidate
        >
          {errors.root && (
            <div
              className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-body text-red-300 animate-fade-in"
              role="alert"
            >
              {errors.root.message}
            </div>
          )}

          <Field label="Email" htmlFor="login-email" error={errors.email?.message}>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              hasError={!!errors.email}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="login-password" error={errors.password?.message}>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              hasError={!!errors.password}
              {...register('password')}
            />
          </Field>

          <Button type="submit" loading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>

        {/* Demo accounts — one-tap fill */}
        <div className="mt-4 glass p-3 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <p className="text-caption text-zinc-500 mb-2">Demo accounts — click to fill</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => {
                  setValue('email', acc.email);
                  setValue('password', acc.password);
                }}
                className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-caption text-zinc-300 hover:bg-white/[0.08] hover:border-primary-500/40 transition-all duration-150 ease-out-expo active:scale-[0.97]"
              >
                {acc.role}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-body text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-primary-400 font-medium hover:text-primary-300 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
