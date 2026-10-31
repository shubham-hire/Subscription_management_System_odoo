import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Decimal } from 'decimal.js';

const MONEY_RE = /^-?\d+(\.\d+)?$/;

/**
 * Contract rule (docs/api-contract.md): money is a 2-decimal string.
 * Prisma Decimal serializes via toJSON as "1999" — this normalizes every
 * Decimal (and numeric-looking string) to exactly 2 places on the way out.
 */
@Injectable()
export class MoneyFormatInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => normalizeMoney(data)));
  }
}

/** Exported for unit tests — see money-format.interceptor.spec.ts */
export function normalizeMoney(value: unknown): unknown {
  // Prisma ships its own decimal.js bundle — instanceof fails across copies,
  // so duck-type the Decimal shape (s/e/d internals + toFixed).
  if (isDecimalLike(value)) return (value as { toFixed(f?: number): string }).toFixed(2);
  if (Array.isArray(value)) return value.map(normalizeMoney);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeMoney(v);
    }
    return out;
  }
  if (typeof value === 'string' && MONEY_RE.test(value) && value.includes('.') && value.split('.')[1].length !== 2) {
    return new Decimal(value).toFixed(2);
  }
  return value;
}

function isDecimalLike(value: unknown): boolean {
  return (
    value instanceof Decimal ||
    (typeof value === 'object' &&
      value !== null &&
      's' in value && 'e' in value && 'd' in value &&
      typeof (value as { toFixed?: unknown }).toFixed === 'function')
  );
}
