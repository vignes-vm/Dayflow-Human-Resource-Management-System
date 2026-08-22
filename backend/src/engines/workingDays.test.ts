import { describe, expect, it } from "vitest";

import { computeWorkingDays } from "@/engines/workingDays.js";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("computeWorkingDays", () => {
  it("counts a plain working week with no holidays", () => {
    // Mon 2026-01-05 to Fri 2026-01-09
    const result = computeWorkingDays({
      startDate: d("2026-01-05"),
      endDate: d("2026-01-09"),
      workDaysPerWeek: 5,
      holidays: [],
    });
    expect("days" in result && result.days).toBe(5);
  });

  it("drops weekend days", () => {
    // Mon 2026-01-05 to Sun 2026-01-11 — 5 working days, Sat+Sun excluded
    const result = computeWorkingDays({
      startDate: d("2026-01-05"),
      endDate: d("2026-01-11"),
      workDaysPerWeek: 5,
      holidays: [],
    });
    expect("days" in result && result.days).toBe(5);
    expect(result.excludedDates.filter((e) => e.reason === "Weekend")).toHaveLength(2);
  });

  it("drops a holiday that falls on a working day, naming it in excludedDates", () => {
    const result = computeWorkingDays({
      startDate: d("2026-01-12"),
      endDate: d("2026-01-14"),
      workDaysPerWeek: 5,
      holidays: [{ date: d("2026-01-13"), name: "Dussehra" }],
    });
    expect("days" in result && result.days).toBe(2);
    expect(result.excludedDates).toContainEqual({
      date: "2026-01-13",
      reason: "Public holiday — Dussehra",
    });
  });

  it("applies a half-day deduction", () => {
    const result = computeWorkingDays({
      startDate: d("2026-01-12"),
      endDate: d("2026-01-13"),
      workDaysPerWeek: 5,
      holidays: [],
      halfDay: "FIRST_HALF",
    });
    expect("days" in result && result.days).toBe(1.5);
  });

  it("returns ZERO_WORKING_DAYS for a range that is entirely holidays", () => {
    const result = computeWorkingDays({
      startDate: d("2026-01-12"),
      endDate: d("2026-01-12"),
      workDaysPerWeek: 5,
      holidays: [{ date: d("2026-01-12"), name: "Company Day" }],
    });
    expect("error" in result && result.error).toBe("ZERO_WORKING_DAYS");
  });

  it("returns ZERO_WORKING_DAYS for a range that is entirely weekend", () => {
    const result = computeWorkingDays({
      startDate: d("2026-01-10"), // Saturday
      endDate: d("2026-01-11"), // Sunday
      workDaysPerWeek: 5,
      holidays: [],
    });
    expect("error" in result && result.error).toBe("ZERO_WORKING_DAYS");
  });
});
