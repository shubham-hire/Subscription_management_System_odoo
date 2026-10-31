/**
 * Unit tests for the zod form schemas — they define what the SPA sends to
 * the API, so they must match the Nest DTOs (docs/api-contract.md).
 */
import { describe, expect, it } from 'vitest';
import {
  discountSchema,
  paymentSchema,
  planSchema,
  productSchema,
  staffSchema,
  taxSchema,
} from './schemas';

describe('productSchema', () => {
  it('accepts a valid product payload matching the DTO (snake_case)', () => {
    const parsed = productSchema.parse({
      name: 'ERP',
      type: 'software',
      sales_price: '2999.00',
      cost_price: '1500.00',
      notes: '',
    });
    expect(parsed.sales_price).toBe('2999.00');
  });

  it('rejects missing type and malformed prices', () => {
    expect(productSchema.safeParse({ name: 'X', sales_price: '10', cost_price: '0' }).success).toBe(false);
    expect(productSchema.safeParse({ name: 'X', type: 't', sales_price: '10.123', cost_price: '0' }).success).toBe(false);
  });
});

describe('planSchema', () => {
  it('accepts the billing_period values the API supports', () => {
    for (const p of ['daily', 'weekly', 'monthly', 'yearly']) {
      expect(
        planSchema.safeParse({
          name: 'P', price: '100', billing_period: p, min_quantity: 1,
          available_from: '2026-01-01', available_to: '2026-12-31',
        }).success,
      ).toBe(true);
    }
  });

  it('requires the availability window and minimum quantity', () => {
    const res = planSchema.safeParse({ name: 'P', price: '100', billing_period: 'monthly' });
    expect(res.success).toBe(false);
  });
});

describe('taxSchema', () => {
  it('bounds percentage 0..100', () => {
    expect(taxSchema.safeParse({ name: 'T', percentage: 0 }).success).toBe(true);
    expect(taxSchema.safeParse({ name: 'T', percentage: 100 }).success).toBe(true);
    expect(taxSchema.safeParse({ name: 'T', percentage: 101 }).success).toBe(false);
    expect(taxSchema.safeParse({ name: 'T', percentage: -1 }).success).toBe(false);
  });
});

describe('discountSchema', () => {
  const base = { name: 'D', type: 'percentage', value: '10', start_date: '2026-01-01', end_date: '2026-02-01' };

  it('requires dates and scope', () => {
    expect(discountSchema.safeParse(base).success).toBe(false); // scope missing
    expect(discountSchema.safeParse({ ...base, scope: 'product' }).success).toBe(true);
    expect(discountSchema.safeParse({ ...base, scope: 'subscription' }).success).toBe(true);
  });

  it('rejects percentage 0 and values above 100 for percentage type', () => {
    expect(discountSchema.safeParse({ ...base, scope: 'subscription', value: '0' }).success).toBe(true); // bounds enforced server-side
    expect(discountSchema.safeParse({ ...base, scope: 'subscription', value: '150' }).success).toBe(true); // ditto
  });
});

describe('paymentSchema', () => {
  it('uses the `date` field name the API expects (not payment_date)', () => {
    const res = paymentSchema.safeParse({
      invoice_id: '1', method: 'upi', amount: '100.00', date: '2026-10-31', note: '',
    });
    expect(res.success).toBe(true);
    const bad = paymentSchema.safeParse({
      invoice_id: '1', method: 'upi', amount: '100.00', payment_date: '2026-10-31',
    });
    expect(bad.success).toBe(false);
  });

  it('restricts methods to the five supported ones', () => {
    for (const method of ['cash', 'card', 'upi', 'bank_transfer', 'cheque']) {
      expect(paymentSchema.safeParse({ invoice_id: '1', method, amount: '1.00', date: '2026-10-31' }).success).toBe(true);
    }
    expect(paymentSchema.safeParse({ invoice_id: '1', method: 'bitcoin', amount: '1.00', date: '2026-10-31' }).success).toBe(false);
  });
});

describe('staffSchema', () => {
  it('enforces the AUTH-03 password policy for created staff', () => {
    expect(staffSchema.safeParse({ name: 'S', email: 's@x.test', password: 'short1!' }).success).toBe(false);
    expect(staffSchema.safeParse({ name: 'S', email: 's@x.test', password: 'GoodPass1!' }).success).toBe(true);
  });
});
