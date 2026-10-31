import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { signupSchema, type SignupFormValues, PASSWORD_RULES } from '@/lib/schemas';
import { signup, persistToken, getMe } from '@/api/auth';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/api/client';
import { Button, Field, Input } from '@/components/ui';
import { Check, X } from 'lucide-react';

export function SignupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange', // Live validation for password checklist
  });

  const passwordValue = watch('password', '');

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(passwordValue),
  }));

  const allRulesMet = ruleResults.every((r) => r.met);

  const onSubmit = async (data: SignupFormValues) => {
    try {
      const res = await signup(data);
      persistToken(res.token);
      const me = await getMe();
      setUser(me);
      navigate('/portal', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          Object.entries(err.fields).forEach(([field, message]) => {
            setError(field as keyof SignupFormValues, { message });
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
            Create your <span className="text-gradient">account</span>
          </h1>
          <p className="mt-1 text-body text-zinc-500">Get started with Brightloop</p>
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

          <Field label="Full Name" htmlFor="signup-name" error={errors.name?.message}>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              hasError={!!errors.name}
              {...register('name')}
            />
          </Field>

          <Field label="Email" htmlFor="signup-email" error={errors.email?.message}>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              hasError={!!errors.email}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="signup-password" error={errors.password?.message}>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              hasError={!!errors.password}
              {...register('password')}
            />
          </Field>

          {/* Live password checklist */}
          <ul className="space-y-1 pl-1" aria-label="Password requirements">
            {ruleResults.map((rule) => (
              <li
                key={rule.id}
                className={`flex items-center gap-2 text-caption transition-colors duration-150 ${
                  rule.met ? 'text-emerald-400' : 'text-zinc-500'
                }`}
              >
                {rule.met ? (
                  <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <X className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                )}
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>

          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!allRulesMet}
            className="w-full"
          >
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-body text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 font-medium hover:text-primary-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
