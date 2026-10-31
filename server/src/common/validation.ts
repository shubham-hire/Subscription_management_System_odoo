import { ValidateBy } from 'class-validator';

/**
 * Money wire format (D4): decimal string, ≤2 places, non-negative.
 * e.g. "1999.00", "0", "12.5" — rejects numbers and negatives.
 * Pure function so it can be unit-tested directly.
 */
export function isMoneyString(value: unknown): boolean {
  return typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function IsMoneyString(message = 'must be a decimal amount with at most 2 places, zero or more') {
  return ValidateBy({
    name: 'isMoneyString',
    validator: {
      validate: (value: unknown) => isMoneyString(value),
      defaultMessage: () => message,
    },
  });
}
