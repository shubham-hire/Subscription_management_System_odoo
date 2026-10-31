import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { normalizeMoney } from './money-format.interceptor';

/** Mimics Prisma's bundled decimal.js instance (different copy, same shape). */
function prismaLikeDecimal(s: string) {
  const d = new Decimal(s);
  return { s: d.s, e: d.e, d: d.d, toFixed: (f?: number) => d.toFixed(f) };
}

describe('normalizeMoney (contract: money is a 2-decimal string)', () => {
  it('formats Decimal instances to 2 places', () => {
    expect(normalizeMoney(new Decimal('560'))).toBe('560.00');
    expect(normalizeMoney(new Decimal('12.5'))).toBe('12.50');
  });

  it('formats Prisma-bundled Decimals via duck typing (instanceof fails across copies)', () => {
    expect(normalizeMoney(prismaLikeDecimal('2999'))).toBe('2999.00');
    expect(normalizeMoney(prismaLikeDecimal('0'))).toBe('0.00');
  });

  it('normalizes decimal strings with wrong precision, leaves correct ones', () => {
    expect(normalizeMoney('12.5')).toBe('12.50');
    expect(normalizeMoney('1999.00')).toBe('1999.00');
  });

  it('leaves non-money values untouched', () => {
    expect(normalizeMoney('abc')).toBe('abc');
    expect(normalizeMoney('1999')).toBe('1999'); // no dot — not money-formatted
    expect(normalizeMoney(42)).toBe(42);
    expect(normalizeMoney(true)).toBe(true);
    expect(normalizeMoney(null)).toBe(null);
  });

  it('recurses into arrays and objects', () => {
    const d = prismaLikeDecimal('560');
    const out = normalizeMoney({ items: [{ price: d, name: 'x' }], total: new Decimal('10') }) as {
      items: { price: string; name: string }[];
      total: string;
    };
    expect(out.items[0].price).toBe('560.00');
    expect(out.items[0].name).toBe('x');
    expect(out.total).toBe('10.00');
  });

  it('preserves Dates', () => {
    const d = new Date('2026-10-31T00:00:00Z');
    expect(normalizeMoney(d)).toBe(d);
  });
});
