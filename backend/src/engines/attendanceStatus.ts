import type { AttendanceStatus } from "@dayflow/shared";

/**
 * Pure attendance derivation — no DB, no Express. See CLAUDE.md rule 7 and
 * Dayflow-Blueprint-v2.md §10.3.
 */

export interface AttendanceSessionInput {
  inAt: Date;
  outAt: Date | null;
}

export interface ComputedMinutes {
  workMinutes: number;
  breakMinutes: number;
  extraMinutes: number;
}

/**
 * Sums closed-session durations as work time, and gaps between consecutive
 * closed sessions as break time. An open session (outAt null) contributes no
 * work minutes — the daily-close job always closes sessions before deriving
 * final status, so this only matters for stale/unclosed data.
 */
export function computeMinutes(
  sessions: AttendanceSessionInput[],
  standardDailyMinutes: number,
): ComputedMinutes {
  const sorted = [...sessions].sort((a, b) => a.inAt.getTime() - b.inAt.getTime());

  let workMinutes = 0;
  let breakMinutes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i]!;
    if (session.outAt) {
      workMinutes += Math.round((session.outAt.getTime() - session.inAt.getTime()) / 60_000);
    }

    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (prev.outAt) {
        const gapMinutes = Math.round((session.inAt.getTime() - prev.outAt.getTime()) / 60_000);
        if (gapMinutes > 0) breakMinutes += gapMinutes;
      }
    }
  }

  const extraMinutes = Math.max(0, workMinutes - standardDailyMinutes);
  return { workMinutes, breakMinutes, extraMinutes };
}

export interface DeriveStatusInput {
  workMinutes: number;
  standardDailyMinutes: number;
  hasApprovedLeave: boolean;
  isHoliday: boolean;
  isWorkingDay: boolean;
}

/** Threshold table from §10.3 — evaluated in this exact order. */
export function deriveStatus(input: DeriveStatusInput): AttendanceStatus {
  const { workMinutes, standardDailyMinutes, hasApprovedLeave, isHoliday, isWorkingDay } = input;

  if (workMinutes >= 0.75 * standardDailyMinutes) return "PRESENT";
  if (workMinutes >= 0.35 * standardDailyMinutes) return "HALF_DAY";
  if (workMinutes === 0 && hasApprovedLeave) return "ON_LEAVE";
  if (workMinutes === 0 && isHoliday) return "HOLIDAY";
  if (workMinutes === 0 && !isWorkingDay) return "WEEKEND";
  return "ABSENT";
}
