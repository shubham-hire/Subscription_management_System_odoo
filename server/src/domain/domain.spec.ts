/**
 * DEV B'S STARTING TESTS — red until the domain functions are implemented.
 * Run: npm test (in server/). Do not weaken the assertions; add more cases freely.
 * These mirror PRD acceptance #7 (transitions), #8 (billing dates), #4 (pricing).
 */
import { describe, expect, it } from 'vitest';
import { addPeriod } from './billing-dates';
import { computeInvoiceTotals, computeLine } from './pricing';
import { validateTransition } from './transitions';

describe('addPeriod (PRD §6.2)', () => {
  it('advances one month', () => {
    expect(addPeriod(new Date('2026-11-15T00:00:00Z'), 'monthly').toISOString()).toBe(
      '2026-12-15T00:00:00.000Z',
    );
  });
  it('clamps month-end into shorter months', () => {
    expect(addPeriod(new Date('2026-01-31T00:00:00Z'), 'monthly').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
  it('handles leap years', () => {
    expect(addPeriod(new Date('2024-01-31T00:00:00Z'), 'monthly').toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
  });
  it('advances daily and weekly', () => {
    expect(addPeriod(new Date('2026-11-01T00:00:00Z'), 'daily').toISOString()).toBe(
      '2026-11-02T00:00:00.000Z',
    );
    expect(addPeriod(new Date('2026-11-01T00:00:00Z'), 'weekly').toISOString()).toBe(
      '2026-11-08T00:00:00.000Z',
    );
  });
  it('advances yearly', () => {
    expect(addPeriod(new Date('2026-02-28T00:00:00Z'), 'yearly').toISOString()).toBe(
      '2027-02-28T00:00:00.000Z',
    );
  });
});

describe('pricing (PRD §6.1 + acceptance #4)', () => {
  const base = {
    unit_price: '3559.00',
    quantity: 1,
    tax_percent: 18,
    discount_amount: '0.00',
  };

  it('computes subtotal, tax and line total', () => {
    const r = computeLine(base);
    expect(r.subtotal).toBe('3559.00');
    expect(r.tax_amount).toBe('640.62'); // 3559 * 0.18 = 640.62
    expect(r.line_total).toBe('4199.62');
  });

  it('applies discount before tax and clamps at zero (DSC-07)', () => {
    const r = computeLine({ ...base, discount_amount: '355.90' });
    expect(r.tax_amount).toBe('576.56'); // (3559-355.90) * 0.18 = 576.558 -> 576.56
    expect(r.line_total).toBe('3779.66');
    const clamped = computeLine({ ...base, discount_amount: '9999.00' });
    expect(clamped.discount_amount).toBe('3559.00');
    expect(clamped.line_total).toBe('0.00');
  });

  it('sums invoice totals', () => {
    const a = computeLine(base);
    const b = computeLine({ ...base, quantity: 2 });
    const t = computeInvoiceTotals([a, b]);
    expect(t.subtotal).toBe('10677.00');
    expect(t.tax_total).toBe('1921.86');
    expect(t.total).toBe('12598.86');
  });
});

describe('validateTransition (PRD §5.1 + acceptance #7)', () => {
  const plan = { pausable: true, closable: true, renewable: true, auto_close: true };
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('allows the happy path', () => {
    expect(validateTransition({ from: 'draft', to: 'quotation', plan })).toBeNull();
    expect(
      validateTransition({ from: 'quotation', to: 'confirmed', plan, quotation_expires_at: future }),
    ).toBeNull();
    expect(validateTransition({ from: 'confirmed', to: 'active', plan })).toBeNull();
    expect(validateTransition({ from: 'active', to: 'paused', plan })).toBeNull();
    expect(validateTransition({ from: 'paused', to: 'active', plan })).toBeNull();
    expect(validateTransition({ from: 'active', to: 'closed', plan })).toBeNull();
  });

  it('rejects invalid jumps like draft -> active (acceptance #7)', () => {
    expect(validateTransition({ from: 'draft', to: 'active', plan })).not.toBeNull();
    expect(validateTransition({ from: 'quotation', to: 'closed', plan })).not.toBeNull();
  });

  it('enforces plan flags', () => {
    expect(
      validateTransition({ from: 'active', to: 'paused', plan: { ...plan, pausable: false } }),
    ).not.toBeNull();
    expect(
      validateTransition({ from: 'active', to: 'closed', plan: { ...plan, closable: false } }),
    ).not.toBeNull();
    expect(
      validateTransition({ from: 'closed', to: 'active', plan: { ...plan, renewable: false } }),
    ).not.toBeNull();
  });

  it('rejects confirming an expired quotation (D10)', () => {
    expect(
      validateTransition({ from: 'quotation', to: 'confirmed', plan, quotation_expires_at: past }),
    ).not.toBeNull();
  });
});
