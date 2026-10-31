import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Delay unmount so the exit transition can play
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setVisible(true);
      previousFocusRef.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else {
      dialog.close();
      const t = setTimeout(() => setVisible(false), 150);
      previousFocusRef.current?.focus();
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Close on Escape
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  if (!visible) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`
        fixed inset-0
        w-full ${maxWidthClasses[maxWidth]}
        m-auto p-0
        glass glass-edge rounded-xl shadow-dialog
        backdrop:bg-black/70 backdrop:backdrop-blur-sm
        animate-scale-in
        open:animate-scale-in
      `}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby="dialog-title"
    >
      {/* Modals stay transform-origin: center — they are not anchored to a trigger */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="dialog-title" className="text-subheading text-zinc-100">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-body text-zinc-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 flex justify-end gap-3">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
