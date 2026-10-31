import { describe, expect, it } from 'vitest';
import { isMoneyString } from './validation';

describe('isMoneyString (D4 money wire format)', () => {
  it.each(['0', '1999.00', '12.5', '0.01', '1234567'])('accepts %s', (v) => {
    expect(isMoneyString(v)).toBe(true);
  });

  it('accepts surrounding whitespace (trimmed before validating)', () => {
    expect(isMoneyString(' 12.00')).toBe(true);
  });

  it.each(['-5.00', '-0', '1.999', 'abc', '', '12.', '₹5', null, undefined, 5, 5.5, true])(
    'rejects %p',
    (v) => {
      expect(isMoneyString(v)).toBe(false);
    },
  );
});
