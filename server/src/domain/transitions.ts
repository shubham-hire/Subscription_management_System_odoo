/**
 * DEV B OWNS THIS FILE. Pure functions only — no Prisma, no Nest imports.
 * State machine per PRD §5.1 and Plan.md decisions D3/D10.
 *
 * Draft -> Quotation -> Confirmed -> Active -> Closed, plus Paused (Active <->).
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
  // TODO(B): implement + make domain.spec.ts green.
  // Rules: allowed by map above; pause requires plan.pausable; close (early) requires
  // plan.closable; renew/reopen requires plan.renewable; confirm requires quotation
  // not expired (D10). Quotation->Confirmed expiry check uses ctx.now ?? new Date().
  throw new Error('NOT IMPLEMENTED (Dev B): validateTransition');
}
