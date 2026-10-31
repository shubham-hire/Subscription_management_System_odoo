import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// ─── Types ───

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string) => void;
}

// ─── Context ───

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((variant: ToastVariant, message: string) => {
    const id = String(++toastIdCounter);
    setToasts((prev) => [...prev, { id, variant, message }]);

    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

// ─── Presentation ───

const variantStyles: Record<ToastVariant, { glass: string; icon: React.ReactNode }> = {
  success: {
    glass: 'border-emerald-500/30 text-emerald-100',
    icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  },
  error: {
    glass: 'border-red-500/30 text-red-100',
    icon: <AlertCircle className="h-5 w-5 text-red-400" />,
  },
  info: {
    glass: 'border-sky-500/30 text-sky-100',
    icon: <Info className="h-5 w-5 text-sky-400" />,
  },
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const style = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl border
              bg-surface-800/90 backdrop-blur-xl shadow-dialog
              animate-slide-in-right
              ${style.glass}
            `}
            role="alert"
          >
            <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
            <p className="flex-1 text-body">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors active:scale-95"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
