import type { HalfDay } from "@dayflow/shared";

/**
 * Pure working-days expansion for time-off requests — no DB. See CLAUDE.md
 * rule 7 and Dayflow-Blueprint-v2.md §10.4 / Step 12.
 */

export interface HolidayInput {
  date: Date;
  name: string;
}

export interface WorkingDaysInput {
  startDate: Date;
  endDate: Date;
  /** Company.workDaysPerWeek — working weekdays are Mon..this many, matching the payroll engine. */
  workDaysPerWeek: number;
  holidays: HolidayInput[];
  halfDay?: HalfDay;
}

export interface ExcludedDate {
  date: string;
  reason: string;
}

export type WorkingDaysResult =
  | { days: number; excludedDates: ExcludedDate[] }
  | { error: "ZERO_WORKING_DAYS"; excludedDates: ExcludedDate[] };

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

export function computeWorkingDays(input: WorkingDaysInput): WorkingDaysResult {
  const holidayByDate = new Map(input.holidays.map((h) => [toIsoDate(h.date), h.name]));
  const excludedDates: ExcludedDate[] = [];
  let days = 0;

  for (let d = input.startDate; d <= input.endDate; d = addDays(d, 1)) {
    const iso = toIsoDate(d);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun ... 6 = Sat
    const isWorkingWeekday = dayOfWeek >= 1 && dayOfWeek <= input.workDaysPerWeek;

    if (!isWorkingWeekday) {
      excludedDates.push({ date: iso, reason: "Weekend" });
      continue;
    }

    const holidayName = holidayByDate.get(iso);
    if (holidayName) {
      excludedDates.push({ date: iso, reason: `Public holiday — ${holidayName}` });
      continue;
    }

    days += 1;
  }

  if (input.halfDay && input.halfDay !== "NONE" && days > 0) {
    days -= 0.5;
  }

  if (days <= 0) {
    return { error: "ZERO_WORKING_DAYS", excludedDates };
  }

  return { days, excludedDates };
}
