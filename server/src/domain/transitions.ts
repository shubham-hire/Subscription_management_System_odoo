/**
 * Subscription state machine (PRD §5.1) + plan flags (PLN-02) + quotation
 * expiry (D10). Pure — no Prisma, no Nest. Ownership absorbed by Dev A.
 */
export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

export interface PlanFlags {
  pausable: boolean;
  closable: boolean;
  renewable: boolean;
  auto_close: boolean;
}

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  draft: ['quotation'],
  quotation: ['confirmed'],
  confirmed: ['active'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: ['active'], // renew (D3: new term) — plan must be renewable
};

export type TransitionContext = {
  from: SubscriptionStatus;
  to: SubscriptionStatus;
  plan: PlanFlags;
  /** quotation expiry, required when to === 'confirmed' (D10) */
  quotation_expires_at?: Date;
  now?: Date;
};

/** Returns an error string when the transition is invalid, null when valid. */
export function validateTransition(ctx: TransitionContext): string | null {
  const allowed = SUBSCRIPTION_TRANSITIONS[ctx.from];
  if (!allowed.includes(ctx.to)) {
    return `Invalid transition: ${ctx.from} -> ${ctx.to}`;
  }

  switch (ctx.to) {
    case 'paused':
      if (!ctx.plan.pausable) return 'This plan cannot be paused';
      break;
    case 'closed':
      // early close needs closable; auto-close by expiry is enforced by the
      // billing job, not this transition — but a manual close is the same
      // transition, so the flag rules.
      if (!ctx.plan.closable) return 'This plan cannot be closed early';
      break;
    case 'active':
      if (ctx.from === 'closed' && !ctx.plan.renewable) return 'This plan cannot be renewed';
      break;
    case 'confirmed':
      if (ctx.from === 'quotation') {
        const now = ctx.now ?? new Date();
        if (!ctx.quotation_expires_at) return 'Quotation has no expiry date';
        if (ctx.quotation_expires_at.getTime() <= now.getTime()) {
          return 'Quotation has expired — renew or edit it first';
        }
      }
      break;
  }
  return null;
}
