import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'btn-gradient text-white shadow-glow-sm hover:shadow-glow focus-visible:ring-primary-400',
  secondary:
    'bg-white/[0.04] text-zinc-200 border border-white/[0.09] hover:bg-white/[0.08] hover:border-white/[0.16] focus-visible:ring-primary-400',
  ghost:
    'bg-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:ring-primary-400',
  danger:
    'bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20 focus-visible:ring-red-400',
  success:
    'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 focus-visible:ring-emerald-400',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-caption',
  md: 'px-4 py-2 text-body',
  lg: 'px-6 py-3 text-body',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg select-none
        transition-[transform,background-color,border-color,box-shadow,background-image] duration-150 ease-out-expo
        active:scale-[0.97] active:duration-75
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
