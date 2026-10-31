/**
 * DEV B OWNS THIS FILE. Pure functions only — no Prisma, no Nest imports.
 * Money math MUST use decimal.js (Plan.md D4) and return strings with 2 decimals.
 *
 * PRD §6.1:
 *   line subtotal   = unit price × quantity
 *   line tax        = (line subtotal − line discount) × tax percentage   (tax exclusive, D14)
 *   invoice total   = Σ (line subtotal − line discount + line tax)
 * Discount never makes a line negative (DSC-07) — clamp discount at subtotal.
 */

export interface InvoiceLineInput {
  unit_price: string; // decimal string e.g. "3559.00"
  quantity: number; // positive integer
  tax_percent: number; // 0..100
  discount_amount: string; // absolute discount for the line (already resolved from a rule)
  tax_inclusive?: boolean; // false per D14; parameter kept for future
}

export interface InvoiceLineResult {
  subtotal: string;
  discount_amount: string; // clamped
  tax_amount: string;
  line_total: string;
}

export interface InvoiceTotals {
  subtotal: string;
  discount_total: string;
  tax_total: string;
  total: string;
}

export function computeLine(line: InvoiceLineInput): InvoiceLineResult {
  // TODO(B): implement + make domain.spec.ts green
  throw new Error('NOT IMPLEMENTED (Dev B): computeLine');
}

export function computeInvoiceTotals(lines: InvoiceLineResult[]): InvoiceTotals {
  // TODO(B): implement + make domain.spec.ts green
  throw new Error('NOT IMPLEMENTED (Dev B): computeInvoiceTotals');
}
