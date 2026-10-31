/**
 * Edge-case unit tests for the domain layer — calendar boundaries, money
 * rounding extremes, state-machine boundaries. Complements domain.spec.ts
 * (which pins the base behaviours from the PRD examples).
 */
import { describe, expect, it } from 'vitest';
import { addPeriod } from './billing-dates';
import { computeInvoiceTotals, computeLine } from './pricing';
import { validateTransition } from './transitions';

const d = (s: string) => new Date(s);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('addPeriod — calendar edge cases', () => {
  it('rolls over the year end', () => {
    expect(iso(addPeriod(d('2026-12-31T00:00:00Z'), 'monthly'))).toBe('2027-01-31');
  });

  it('clamps 31-day months into 30-day months', () => {
    expect(iso(addPeriod(d('2026-03-31T00:00:00Z'), 'monthly'))).toBe('2026-04-30');
    expect(iso(addPeriod(d('2026-05-31T00:00:00Z'), 'monthly'))).toBe('2026-06-30');
  });

  it('preserves the day when the target month is long enough (Apr 30 → May 30)', () => {
    // the anchor is the ORIGINAL day (30), not "end of month"
    expect(iso(addPeriod(d('2026-04-30T00:00:00Z'), 'monthly'))).toBe('2026-05-30');
  });

  it('leap day + monthly keeps the day in March', () => {
    expect(iso(addPeriod(d('2024-02-29T00:00:00Z'), 'monthly'))).toBe('2024-03-29');
  });

  it('leap day + yearly clamps into the non-leap year', () => {
    expect(iso(addPeriod(d('2024-02-29T00:00:00Z'), 'yearly'))).toBe('2025-02-28');
  });

  it('Feb 28 + yearly keeps Feb 28 (leap→non-leap, day exists)', () => {
    expect(iso(addPeriod(d('2026-02-28T00:00:00Z'), 'yearly'))).toBe('2027-02-28');
  });

  it('daily steps over the month end', () => {
    expect(iso(addPeriod(d('2026-01-31T00:00:00Z'), 'daily'))).toBe('2026-02-01');
  });

  it('weekly crosses month boundaries', () => {
    expect(iso(addPeriod(d('2026-01-28T00:00:00Z'), 'weekly'))).toBe('2026-02-04');
  });

  it('never mutates the input date', () => {
    const input = d('2026-01-31T00:00:00Z');
    addPeriod(input, 'monthly');
    expect(input.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('computeLine — rounding and extremes', () => {
  it('rounds tax half-up at the half paisa (10.05 @ 10% → 1.01)', () => {
    const r = computeLine({ unit_price: '10.05', quantity: 1, tax_percent: 10, discount_amount: '0' });
    expect(r.tax_amount).toBe('1.01'); // 1.005 → HALF_UP
    expect(r.line_total).toBe('11.06');
  });

  it('discount equal to subtotal zeroes the line and its tax', () => {
    const r = computeLine({ unit_price: '500.00', quantity: 2, tax_percent: 18, discount_amount: '1000.00' });
    expect(r.discount_amount).toBe('1000.00');
    expect(r.tax_amount).toBe('0.00');
    expect(r.line_total).toBe('0.00');
  });

  it('100% tax doubles the net amount', () => {
    const r = computeLine({ unit_price: '100.00', quantity: 1, tax_percent: 100, discount_amount: '0' });
    expect(r.line_total).toBe('200.00');
  });

  it('stays exact at large quantities', () => {
    const r = computeLine({ unit_price: '9999.99', quantity: 9000, tax_percent: 18, discount_amount: '0' });
    expect(r.subtotal).toBe('89999910.00');
    expect(r.tax_amount).toBe('16199983.80');
    expect(r.line_total).toBe('106199893.80');
  });

  it('handles the smallest amounts without underflow', () => {
    const r = computeLine({ unit_price: '0.01', quantity: 1, tax_percent: 18, discount_amount: '0' });
    expect(r.subtotal).toBe('0.01');
    expect(r.tax_amount).toBe('0.00'); // 0.0018 → 0.00
    expect(r.line_total).toBe('0.01');
  });

  it('discount is applied before tax, never after (PRD §6.1 ordering)', () => {
    const r = computeLine({ unit_price: '100.00', quantity: 1, tax_percent: 10, discount_amount: '50.00' });
    expect(r.tax_amount).toBe('5.00'); // (100-50)*10%, not 100*10%
    expect(r.line_total).toBe('55.00');
  });

  it('computeInvoiceTotals of an empty invoice is all zeros', () => {
    expect(computeInvoiceTotals([])).toEqual({
      subtotal: '0.00',
      discount_total: '0.00',
      tax_total: '0.00',
      total: '0.00',
    });
  });
});

describe('validateTransition — boundary cases', () => {
  const plan = { pausable: true, closable: true, renewable: true, auto_close: true };

  it('same-state transitions are invalid', () => {
    expect(validateTransition({ from: 'draft', to: 'draft', plan })).not.toBeNull();
    expect(validateTransition({ from: 'active', to: 'active', plan })).not.toBeNull();
    expect(validateTransition({ from: 'closed', to: 'closed', plan })).not.toBeNull();
  });

  it('a quotation expiring exactly now is already expired (<= boundary)', () => {
    const now = new Date('2026-10-31T10:00:00Z');
    expect(
      validateTransition({ from: 'quotation', to: 'confirmed', plan, quotation_expires_at: now, now }),
    ).not.toBeNull();
  });

  it('a quotation expiring one ms later is still confirmable', () => {
    const now = new Date('2026-10-31T10:00:00Z');
    expect(
      validateTransition({
        from: 'quotation', to: 'confirmed', plan,
        quotation_expires_at: new Date(now.getTime() + 1), now,
      }),
    ).toBeNull();
  });

  it('confirming without an expiry date is rejected (no silent default)', () => {
    expect(validateTransition({ from: 'quotation', to: 'confirmed', plan })).not.toBeNull();
  });

  it('paused → closed is allowed only when closable', () => {
    expect(validateTransition({ from: 'paused', to: 'closed', plan })).toBeNull();
    expect(
      validateTransition({ from: 'paused', to: 'closed', plan: { ...plan, closable: false } }),
    ).not.toBeNull();
  });

  it('renew (closed → active) requires the renewable flag', () => {
    expect(validateTransition({ from: 'closed', to: 'active', plan })).toBeNull();
    expect(
      validateTransition({ from: 'closed', to: 'active', plan: { ...plan, renewable: false } }),
    ).not.toBeNull();
  });
});
