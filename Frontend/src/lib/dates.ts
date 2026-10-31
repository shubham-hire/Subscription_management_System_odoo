/**
 * Date helpers — IST (Asia/Kolkata) defines "today" per decision D15.
 * All dates are handled as 'YYYY-MM-DD' strings; timestamps as ISO strings.
 */

const IST_OFFSET_MINUTES = 330; // +5:30

/** Current date in IST as 'YYYY-MM-DD' */
export function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (IST_OFFSET_MINUTES + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
}

/** Parse 'YYYY-MM-DD' into a local-date-safe Date (noon UTC avoids TZ drift) */
export function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** Format a Date as 'YYYY-MM-DD' */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add n days to an ISO date */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/**
 * Add one billing period. Month-end rule (PRD §6.2): if the original day
 * does not exist in the target month, use the last day of that month.
 */
export function addPeriod(
  iso: string,
  interval: 'day' | 'week' | 'month' | 'year',
  count = 1,
): string {
  const d = parseDate(iso);
  const originalDay = d.getUTCDate();

  switch (interval) {
    case 'day':
      d.setUTCDate(d.getUTCDate() + count);
      break;
    case 'week':
      d.setUTCDate(d.getUTCDate() + 7 * count);
      break;
    case 'month':
      d.setUTCDate(1); // clamp-safe
      d.setUTCMonth(d.getUTCMonth() + count);
      break;
    case 'year':
      d.setUTCDate(1);
      d.setUTCFullYear(d.getUTCFullYear() + count);
      break;
  }

  if (interval === 'month' || interval === 'year') {
    const daysInMonth = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(originalDay, daysInMonth));
  }

  return toISODate(d);
}

/** Whole days between two ISO dates (b - a) */
export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86400000);
}

const DISPLAY = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** '2026-10-31' or a full ISO timestamp → '31 Oct 2026' */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  // The API returns date-only strings for some fields and full ISO
  // timestamps for others — normalize to the date part before parsing.
  const datePart = String(iso).split('T')[0];
  return DISPLAY.format(parseDate(datePart));
}

/** ISO timestamp → '31 Oct 2026, 2:45 pm' */
export function formatDateTime(isoTimestamp: string): string {
  if (!isoTimestamp) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(isoTimestamp));
}
