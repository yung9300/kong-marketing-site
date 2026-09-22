// Date helpers. Everything is keyed by Malaysia time (UTC+8, no daylight
// saving), so a "day" in the store means a Kuala Lumpur calendar day.

export const TZ = "Asia/Kuala_Lumpur";
const OFFSET_MS = 8 * 60 * 60 * 1000;

/** YYYY-MM-DD in Malaysia time for a given instant. */
export function myDay(date: Date = new Date()): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD string by a number of days (negative = earlier). */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The N days ending on `endDay` inclusive, oldest first. */
export function daysEnding(endDay: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftDay(endDay, -i));
  return out;
}

export function isValidDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  // Round-trip so 2026-02-30 is rejected instead of rolling into March.
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}
