import { startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Company-timezone "today" as a UTC midnight Date, matching how `@db.Date`
 * columns are compared throughout the schema. Centralised here per
 * CLAUDE.md's "no scattered new Date() maths" rule (blueprint Step 10).
 */
export function companyToday(timezone: string): Date {
  const localNow = toZonedTime(new Date(), timezone);
  const start = startOfDay(localNow);
  return new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
}

/** Parses a `YYYY-MM-DD` string as a UTC midnight Date for `@db.Date` comparisons. */
export function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
