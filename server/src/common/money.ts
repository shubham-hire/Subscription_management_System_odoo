import { Decimal } from 'decimal.js';

Decimal.set({ precision: 14, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Format a Decimal (or numeric column result) as a 2-decimal string — the wire format (D4). */
export function money(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}
