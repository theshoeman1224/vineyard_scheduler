// Pure date helpers for 'YYYY-MM-DD' strings (local time, no timezone drift).

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(now: Date = new Date()): string {
  return toDateString(now);
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysStr(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

export function dateRange(start: string, endInclusive: string): string[] {
  if (!isValidDateStr(start) || !isValidDateStr(endInclusive)) return [];
  if (start > endInclusive) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= endInclusive) {
    out.push(cur);
    cur = addDaysStr(cur, 1);
  }
  return out;
}

// Byte-wise comparator for 'YYYY-MM-DD' strings. Deliberately NOT
// localeCompare: fixed-width zero-padded ISO dates sort identically by
// byte comparison in every environment, while collations may treat the
// hyphen as variable-weight punctuation and reorder them.
export function compareDateStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortUniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort(compareDateStr);
}

// Splits whitespace- or comma-separated text into candidate date strings.
export function dateTextParts(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parses a dates textarea (one per line or comma-separated) into a
// sorted list, silently dropping entries that are not valid dates.
export function parseDatesText(raw: string): string[] {
  return dateTextParts(raw).filter(isValidDateStr).sort(compareDateStr);
}

// Inverse of parseDatesText for rendering a textarea.
export function datesToText(dates: string[]): string {
  return dates.join("\n");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateHuman(s: string): string {
  if (!isValidDateStr(s)) return s;
  const d = parseDate(s);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

