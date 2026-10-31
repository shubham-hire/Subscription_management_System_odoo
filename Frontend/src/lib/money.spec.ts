/**
 * Unit tests for lib/money — decimal-safe INR formatting and arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, multiplyMoney, subtractMoney } from './money';

describe('formatMoney', () => {
  it('formats with the INR symbol and Indian digit grouping', () => {
    expect(formatMoney('1234.50')).toMatch(/₹/);
    expect(formatMoney('1234.50')).toContain('1,234.50');
  });

  it('handles the lakh grouping the demo dashboard shows', () => {
    // Indian numbering: 16991469.96 -> 1,69,91,469.96
    expect(formatMoney('16991469.96')).toContain('1,69,91,469.96');
  });

  it('rounds to 2 places', () => {
    expect(formatMoney('10.056')).toMatch(/10\.06/);
  });

  it('formats zero', () => {
    expect(formatMoney('0.00')).toMatch(/0(\.00)?/);
  });
});

describe('decimal arithmetic helpers', () => {
  it('adds without float drift (0.1 + 0.2)', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30');
  });

  it('subtracts to zero cleanly', () => {
    expect(subtractMoney('1180.00', '1180.00')).toBe('0.00');
  });

  it('multiplies string money by quantity', () => {
    expect(multiplyMoney('3559.00', 2)).toBe('7118.00');
    expect(multiplyMoney('9999.99', '9000')).toBe('89999910.00');
  });

  it('handles negative results (refunds/credit contexts)', () => {
    expect(subtractMoney('100.00', '250.00')).toBe('-150.00');
  });
});
