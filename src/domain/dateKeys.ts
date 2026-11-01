/** Mobile-only helpers for YYYY-MM-DD local date keys. Web dates.ts stays verbatim. */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for real calendar dates in strict YYYY-MM-DD form (rejects 2025-02-30). */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Local calendar date key of an ISO timestamp, using the device's time zone. */
export function localDateOfIso(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
