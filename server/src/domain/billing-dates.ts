/**
 * DEV B OWNS THIS FILE. Pure functions only — no Prisma, no Nest imports.
 *
 * PRD §6.2: "advance by one billing period (day, week, month or year).
 * Month-end rule: if the original day does not exist in the target month,
 * use the last day of that month."
 */
export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Advance a billing date by exactly one period.
 * Examples (PRD risk table + acceptance #8):
 *   addPeriod(2026-01-31, 'monthly') -> 2026-02-28  (month-end clamp)
 *   addPeriod(2024-01-31, 'monthly') -> 2024-02-29  (leap year)
 *   addPeriod(2026-11-15, 'monthly') -> 2026-12-15
 *   addPeriod(2026-02-28, 'yearly')  -> 2027-02-28
 *   addPeriod(2026-11-01, 'daily')   -> 2026-11-02
 *   addPeriod(2026-11-01, 'weekly')  -> 2026-11-08
 * The input Date must not be mutated.
 */
export function addPeriod(date: Date, period: BillingPeriod): Date {
  // TODO(B): implement + make domain.spec.ts green
  throw new Error('NOT IMPLEMENTED (Dev B): addPeriod');
}
