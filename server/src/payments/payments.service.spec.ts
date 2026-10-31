import { describe, expect, it } from 'vitest';
import { isOverdue, startOfToday } from './payments.service';

const DAY = 86_400_000;
const base = {
  status: 'confirmed' as const,
  total: '3779.66',
  amountPaid: '0',
  dueDate: new Date(Date.now() - 5 * DAY),
};

describe('isOverdue (D5: Confirmed + balance > 0 + due date before today)', () => {
  it.each([
    ['confirmed unpaid past-due is overdue', { ...base }, true],
    ['paid invoice is never overdue', { ...base, amountPaid: '3779.66' }, false],
    ['draft is never overdue', { ...base, status: 'draft' as const }, false],
    ['cancelled is never overdue', { ...base, status: 'cancelled' as const }, false],
    ['paid status is never overdue', { ...base, status: 'paid' as const }, false],
    ['future due date is not overdue', { ...base, dueDate: new Date(Date.now() + 5 * DAY) }, false],
    ['partial payment keeps overdue', { ...base, amountPaid: '1000.00' }, true],
    ['due exactly at midnight today is not overdue', { ...base, dueDate: startOfToday() }, false],
  ])('%s', (_name, invoice, expected) => {
    expect(isOverdue(invoice)).toBe(expected);
  });
});

describe('startOfToday', () => {
  it('returns local midnight', () => {
    const t = startOfToday();
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
    expect(t.getSeconds()).toBe(0);
    expect(t.getMilliseconds()).toBe(0);
    expect(t.getDate()).toBe(new Date().getDate());
  });
});
