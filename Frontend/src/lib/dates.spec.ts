/**
 * Unit tests for lib/dates — including the regression for the silent
 * dashboard crash: formatDate must accept BOTH date-only strings and full
 * ISO timestamps (the API returns timestamps for some fields).
 */
import { describe, expect, it } from 'vitest';
import { addPeriod, daysBetween, formatDate, parseDate, todayIST, toISODate } from './dates';

describe('formatDate', () => {
  it('formats date-only strings', () => {
    expect(formatDate('2026-10-31')).toBe('31 Oct 2026');
  });

  it('REGRESSION: formats full ISO timestamps without throwing', () => {
    // the API returns timestamps for due_date/startDate etc.
    expect(() => formatDate('2026-10-16T00:00:00.000Z')).not.toThrow();
    expect(formatDate('2026-10-16T00:00:00.000Z')).toBe('16 Oct 2026');
  });

  it('normalizes timestamps and date-only strings to the same output', () => {
    expect(formatDate('2026-10-16')).toBe(formatDate('2026-10-16T00:00:00.000Z'));
  });

  it('returns an em dash for empty input', () => {
    expect(formatDate('')).toBe('—');
  });

  it('keeps UTC date semantics (no timezone drift across the day)', () => {
    // 2026-03-05 stored as UTC midnight must render as 5 Mar regardless of
    // the machine's local timezone
    expect(formatDate('2026-03-05T00:00:00.000Z')).toBe('5 Mar 2026');
  });
});

describe('todayIST', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseDate / toISODate', () => {
  it('round-trips a date-only string at noon UTC (TZ-drift safe)', () => {
    expect(toISODate(parseDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('addPeriod (client mirror of the domain rule)', () => {
  it('clamps month-end into shorter months', () => {
    expect(addPeriod('2026-01-31', 'month')).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addPeriod('2024-01-31', 'month')).toBe('2024-02-29');
  });

  it('supports every interval the UI offers', () => {
    expect(addPeriod('2026-11-01', 'day')).toBe('2026-11-02');
    expect(addPeriod('2026-11-01', 'week')).toBe('2026-11-08');
    expect(addPeriod('2026-11-01', 'month')).toBe('2026-12-01');
    expect(addPeriod('2026-11-01', 'year')).toBe('2027-11-01');
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-16')).toBe(15);
    expect(daysBetween('2026-10-16', '2026-10-01')).toBe(-15);
  });
});
