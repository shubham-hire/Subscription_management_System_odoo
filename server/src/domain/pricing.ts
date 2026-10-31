/**
 * Pure pricing math (PRD §6.1). Money MUST use decimal.js (D4) and return
 * strings with 2 decimals. Discount clamped at subtotal (DSC-07), tax
 * exclusive (D14). Ownership absorbed by Dev A (Plan-B.md).
 */
import { Decimal } from 'decimal.js';

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

const D2 = (d: Decimal) => d.toFixed(2);

export function computeLine(line: InvoiceLineInput): InvoiceLineResult {
  const unit = new Decimal(line.unit_price);
  const qty = new Decimal(line.quantity);
  const subtotal = unit.mul(qty);

  let discount = new Decimal(line.discount_amount);
  if (discount.isNegative()) discount = new Decimal(0); // DSC-07 lower clamp
  if (discount.gt(subtotal)) discount = subtotal; // DSC-07 upper clamp

  const taxable = subtotal.minus(discount);
  const tax = taxable.mul(line.tax_percent).div(100);
  const lineTotal = taxable.plus(tax);

  return {
    subtotal: D2(subtotal),
    discount_amount: D2(discount),
    tax_amount: D2(tax),
    line_total: D2(lineTotal),
  };
}

export function computeInvoiceTotals(lines: InvoiceLineResult[]): InvoiceTotals {
  const sum = (pick: (l: InvoiceLineResult) => string) =>
    lines.reduce((acc, l) => acc.plus(pick(l)), new Decimal(0));

  const subtotal = sum((l) => l.subtotal);
  const discount = sum((l) => l.discount_amount);
  const tax = sum((l) => l.tax_amount);
  const total = sum((l) => l.line_total);

  return {
    subtotal: D2(subtotal),
    discount_total: D2(discount),
    tax_total: D2(tax),
    total: D2(total),
  };
}
