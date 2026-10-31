/**
 * DEV B OWNS THIS FILE. Pure functions only — no Prisma, no Nest imports.
 * (Ownership absorbed by Dev A — Plan-B.md)
 *
 * PRD §6.2: "advance by one billing period (day, week, month or year).
 * Month-end rule: if the original day does not exist in the target month,
 * use the last day of that month."
 */
export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Advance a billing date by exactly one period.
 *   addPeriod(2026-01-31, 'monthly') -> 2026-02-28  (month-end clamp)
 *   addPeriod(2024-01-31, 'monthly') -> 2024-02-29  (leap year)
 *   addPeriod(2026-11-15, 'monthly') -> 2026-12-15
 *   addPeriod(2026-02-28, 'yearly')  -> 2027-02-28
 * The input Date must not be mutated.
 */
export function addPeriod(date: Date, period: BillingPeriod): Date {
  const result = new Date(date.getTime());
  switch (period) {
    case 'daily':
      result.setUTCDate(result.getUTCDate() + 1);
      return result;
    case 'weekly':
      result.setUTCDate(result.getUTCDate() + 7);
      return result;
    case 'monthly':
      return addMonthsClamped(result, 1);
    case 'yearly':
      return addMonthsClamped(result, 12);
  }
}

/**
 * Month arithmetic with the month-end clamp: Jan 31 + 1 month = Feb 28/29.
 * Keeps the original day-of-month when the target month is long enough.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const originalDay = date.getUTCDate();
  const target = new Date(date.getTime());
  target.setUTCDate(1); // avoid overflow before setting the month
  target.setUTCMonth(target.getUTCMonth() + months);
  const daysInTargetMonth = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return target;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
