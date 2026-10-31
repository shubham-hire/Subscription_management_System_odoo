import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { money } from './money';

describe('money() — decimal to 2-place string', () => {
  it('pads whole and short decimals', () => {
    expect(money('10')).toBe('10.00');
    expect(money('1.5')).toBe('1.50');
    expect(money(0)).toBe('0.00');
  });

  it('accepts Decimal inputs and rounds half-up', () => {
    expect(money(new Decimal('1.005'))).toBe('1.01');
  });

  it('keeps already-2-place values untouched', () => {
    expect(money('1999.99')).toBe('1999.99');
  });
});
