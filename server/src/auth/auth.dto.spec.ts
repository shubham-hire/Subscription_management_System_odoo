import { describe, expect, it } from 'vitest';
import { passwordRule } from './auth.dto';

describe('passwordRule (AUTH-03: ≥9 chars, upper, lower, special — first failure wins)', () => {
  it('accepts a compliant password', () => {
    expect(passwordRule('GoodPass1!')).toBeNull();
    expect(passwordRule('abcdefghI1!')).toBeNull();
  });

  it('reports each missing rule', () => {
    expect(passwordRule('Ab1!')).toContain('at least 9 characters');
    expect(passwordRule('alllower1!')).toContain('uppercase');
    expect(passwordRule('ALLUPPER1!')).toContain('lowercase');
    expect(passwordRule('NoSpecial11')).toContain('special');
  });

  it('checks rules in order (length before composition)', () => {
    // fails length AND uppercase — message must be about length
    expect(passwordRule('ab1!')).toContain('9 characters');
  });
});
