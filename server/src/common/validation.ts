import { ValidateBy } from 'class-validator';

/**
 * Money wire format (D4): decimal string, ≤2 places, non-negative.
 * e.g. "1999.00", "0", "12.5" — rejects numbers and negatives.
 */
export function IsMoneyString(message = 'must be a decimal amount with at most 2 places, zero or more') {
  return ValidateBy({
    name: 'isMoneyString',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim()),
      defaultMessage: () => message,
    },
  });
}
