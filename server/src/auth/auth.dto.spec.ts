import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDto, passwordRule } from './auth.dto';

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

describe('SignupDto — email normalization before validation (§9.3)', () => {
  it('trims and lowercases the email during transformation', async () => {
    const dto = plainToInstance(SignupDto, {
      name: 'A',
      email: '  Norm@Case.COM ',
      password: 'GoodPass1!',
    });
    expect(dto.email).toBe('norm@case.com');
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'email')).toBeUndefined();
  });

  it('rejects an unparseable email and a missing password with field errors', async () => {
    const dto = plainToInstance(SignupDto, { name: 'A', email: 'not-an-email', password: '' });
    const errors = await validate(dto);
    const fields = errors.map((e) => e.property).sort();
    expect(fields).toEqual(['email', 'password']);
  });

  it('rejects non-string emails without crashing the pipe', async () => {
    const dto = plainToInstance(SignupDto, { name: 'A', email: 42, password: 'GoodPass1!' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'email')).toBeDefined();
  });
});
