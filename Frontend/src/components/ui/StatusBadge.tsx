type StatusType =
  | 'active'
  | 'paid'
  | 'paused'
  | 'pending'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled'
  | 'closed_failed'
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'closed';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

/**
 * Centralized status → color mapping.
 * green  = Paid / Active
 * amber  = Paused / Pending / Partially paid
 * red    = Overdue / Cancelled / Closed-failed
 * blue   = Draft / Quotation / Confirmed
 * gray   = Closed
 * Each badge carries a glowing status dot — the light source makes state readable at a glance.
 */
const statusConfig: Record<
  StatusType,
  { label: string; badge: string; dot: string }
> = {
  active: {
    label: 'Active',
    badge: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25',
    dot: 'bg-emerald-400 shadow-glow-green',
  },
  paid: {
    label: 'Paid',
    badge: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25',
    dot: 'bg-emerald-400 shadow-glow-green',
  },
  confirmed: {
    label: 'Confirmed',
    badge: 'bg-sky-500/10 text-sky-300 border border-sky-500/25',
    dot: 'bg-sky-400 shadow-glow-blue',
  },
  paused: {
    label: 'Paused',
    badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/25',
    dot: 'bg-amber-400 shadow-glow-amber',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/25',
    dot: 'bg-amber-400 shadow-glow-amber',
  },
  partially_paid: {
    label: 'Partially Paid',
    badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/25',
    dot: 'bg-amber-400 shadow-glow-amber',
  },
  overdue: {
    label: 'Overdue',
    badge: 'bg-red-500/10 text-red-300 border border-red-500/25',
    dot: 'bg-red-400 shadow-glow-red',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-red-500/10 text-red-300 border border-red-500/25',
    dot: 'bg-red-400 shadow-glow-red',
  },
  closed_failed: {
    label: 'Closed (Failed)',
    badge: 'bg-red-500/10 text-red-300 border border-red-500/25',
    dot: 'bg-red-400 shadow-glow-red',
  },
  draft: {
    label: 'Draft',
    badge: 'bg-sky-500/10 text-sky-300 border border-sky-500/25',
    dot: 'bg-sky-400 shadow-glow-blue',
  },
  quotation: {
    label: 'Quotation',
    badge: 'bg-sky-500/10 text-sky-300 border border-sky-500/25',
    dot: 'bg-sky-400 shadow-glow-blue',
  },
  closed: {
    label: 'Closed',
    badge: 'bg-white/[0.05] text-zinc-400 border border-white/[0.1]',
    dot: 'bg-zinc-500',
  },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-0.5
        rounded-full
        text-caption font-medium whitespace-nowrap
        ${config.badge}
        ${className}
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export type { StatusType };
