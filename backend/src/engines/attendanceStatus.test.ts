import { describe, expect, it } from "vitest";

import { computeMinutes, deriveStatus } from "@/engines/attendanceStatus.js";

const STANDARD = 480; // 8 hours

function at(hh: number, mm = 0): Date {
  return new Date(Date.UTC(2026, 0, 1, hh, mm, 0));
}

describe("computeMinutes", () => {
  it("computes work minutes for a single closed session", () => {
    const result = computeMinutes([{ inAt: at(9), outAt: at(17) }], STANDARD);
    expect(result.workMinutes).toBe(480);
    expect(result.breakMinutes).toBe(0);
    expect(result.extraMinutes).toBe(0);
  });

  it("sums two sessions and counts the gap between them as a break", () => {
    const result = computeMinutes(
      [
        { inAt: at(9), outAt: at(13) },
        { inAt: at(14), outAt: at(18) },
      ],
      STANDARD,
    );
    expect(result.workMinutes).toBe(480);
    expect(result.breakMinutes).toBe(60);
  });

  it("sums four sessions with breaks between each", () => {
    const result = computeMinutes(
      [
        { inAt: at(9), outAt: at(11) },
        { inAt: at(11, 15), outAt: at(13) },
        { inAt: at(14), outAt: at(16) },
        { inAt: at(16, 10), outAt: at(18) },
      ],
      STANDARD,
    );
    expect(result.workMinutes).toBe(2 * 60 + 105 + 2 * 60 + 110);
    expect(result.breakMinutes).toBe(15 + 60 + 10);
  });

  it("computes extra minutes past standard", () => {
    const result = computeMinutes([{ inAt: at(9), outAt: at(19) }], STANDARD);
    expect(result.extraMinutes).toBe(120);
  });

  it("does not count an open session's minutes", () => {
    const result = computeMinutes([{ inAt: at(9), outAt: null }], STANDARD);
    expect(result.workMinutes).toBe(0);
  });

  it("handles unsorted session input", () => {
    const result = computeMinutes(
      [
        { inAt: at(14), outAt: at(18) },
        { inAt: at(9), outAt: at(13) },
      ],
      STANDARD,
    );
    expect(result.workMinutes).toBe(480);
    expect(result.breakMinutes).toBe(60);
  });
});

describe("deriveStatus", () => {
  const base = {
    standardDailyMinutes: STANDARD,
    hasApprovedLeave: false,
    isHoliday: false,
    isWorkingDay: true,
  };

  it("is PRESENT at exactly 75% of standard", () => {
    expect(deriveStatus({ ...base, workMinutes: 360 })).toBe("PRESENT");
  });

  it("is PRESENT above 75%", () => {
    expect(deriveStatus({ ...base, workMinutes: 480 })).toBe("PRESENT");
  });

  it("is HALF_DAY at exactly 35% of standard", () => {
    expect(deriveStatus({ ...base, workMinutes: 168 })).toBe("HALF_DAY");
  });

  it("is HALF_DAY just below the PRESENT boundary", () => {
    expect(deriveStatus({ ...base, workMinutes: 359 })).toBe("HALF_DAY");
  });

  it("is ABSENT just below the HALF_DAY boundary with no leave/holiday", () => {
    expect(deriveStatus({ ...base, workMinutes: 167 })).toBe("ABSENT");
  });

  it("is ON_LEAVE with zero minutes and approved leave", () => {
    expect(deriveStatus({ ...base, workMinutes: 0, hasApprovedLeave: true })).toBe("ON_LEAVE");
  });

  it("is HOLIDAY with zero minutes on a holiday", () => {
    expect(deriveStatus({ ...base, workMinutes: 0, isHoliday: true })).toBe("HOLIDAY");
  });

  it("is WEEKEND with zero minutes on a non-working day", () => {
    expect(deriveStatus({ ...base, workMinutes: 0, isWorkingDay: false })).toBe("WEEKEND");
  });

  it("is ABSENT with zero minutes and no leave, holiday, or weekend", () => {
    expect(deriveStatus({ ...base, workMinutes: 0 })).toBe("ABSENT");
  });
});
