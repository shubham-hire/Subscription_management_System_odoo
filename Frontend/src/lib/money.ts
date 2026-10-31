import Decimal from 'decimal.js';

/**
 * Format a money string for display using INR locale.
 * Money values from the API are always strings like "1234.50".
 */
export function formatMoney(value: string): string {
  const num = new Decimal(value).toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(num);
}

/**
 * Safe addition of money strings using decimal.js.
 * Returns a string with 2 decimal places.
 */
export function addMoney(a: string, b: string): string {
  return new Decimal(a).plus(new Decimal(b)).toFixed(2);
}

/**
 * Safe subtraction of money strings using decimal.js.
 */
export function subtractMoney(a: string, b: string): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed(2);
}

/**
 * Safe multiplication of a money string by a number/string.
 */
export function multiplyMoney(amount: string, multiplier: string | number): string {
  return new Decimal(amount).times(new Decimal(multiplier)).toFixed(2);
}
