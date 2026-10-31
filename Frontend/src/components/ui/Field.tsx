import React from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, required, error, hint, children, className = '' }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-body font-medium text-zinc-300"
      >
        {label}
        {required && <span className="text-primary-400 ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-caption text-red-400 animate-fade-in" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared dark input styling */
const inputBase = `
  block w-full rounded-lg border px-3 py-2
  text-body text-zinc-100
  bg-surface-700/60
  placeholder:text-zinc-600
  transition-[border-color,box-shadow] duration-150 ease-out-expo
  focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500
  disabled:bg-surface-800 disabled:text-zinc-500 disabled:cursor-not-allowed
`;

const inputError = 'border-red-500/60 focus:ring-red-500/40 focus:border-red-500';
const inputOk = 'border-white/[0.09] hover:border-white/[0.16]';

/** Styled input for use inside Field */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ hasError, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${inputBase} ${hasError ? inputError : inputOk} ${className}`}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

/** Styled select for use inside Field */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ hasError, className = '', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`${inputBase} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-9 [&>option]:bg-surface-800 ${hasError ? inputError : inputOk} ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = 'Select';

/** Styled textarea for use inside Field */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={3}
        className={`${inputBase} ${hasError ? inputError : inputOk} ${className}`}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
