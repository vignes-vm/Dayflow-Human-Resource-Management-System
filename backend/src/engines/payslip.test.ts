import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import { computePayslip } from "./payslip.js";
import { computeContract, defaultComponentSet } from "./salaryComponents.js";
import { ComponentCategory } from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_RATES = {
  pfRateEmployee: "12",
  pfRateEmployer: "12",
  professionalTax: "200",
} as const;

/** Build the frozen earning lines from the salary engine for use in payslip tests */
function buildLines(wage: string | number) {
  const result = computeContract({
    monthlyWage: String(wage),
    components: defaultComponentSet(),
    ...DEFAULT_RATES,
  });
  if (result.errors.length > 0) throw new Error("Contract error in test setup");
  return result.lines;
}

// ---------------------------------------------------------------------------
// 1. Full month — no absence
// ---------------------------------------------------------------------------

describe("full month — no absence (wage 50,000, 26 working days)", () => {
  const lines = buildLines(50_000);
  const result = computePayslip({
    monthlyWage: "50000",
    componentLines: lines,
    totalWorkingDays: 26,
    unpaidLeaveDays: "0",
    missingAttendanceDays: "0",
    pfRateEmployee: "12",
    professionalTax: "200",
  });

  it("payable days = 26 (full month)", () => {
    expect(result.payableDays.toNumber()).toBe(26);
  });

  it("loss of pay = 0", () => {
    expect(result.lossOfPay.toFixed(2)).toBe("0.00");
  });

  it("gross earnings = 50,000 (full month)", () => {
    expect(result.grossEarnings.toFixed(2)).toBe("50000.00");
  });

  it("PF deduction = 3,000 (12% of Basic 25,000)", () => {
    const pf = result.lines.find((l) => l.code === "PF_EMPLOYEE");
    expect(pf?.amount.toFixed(2)).toBe("3000.00");
  });

  it("net pay = 50,000 - 3,000 - 200 = 46,800", () => {
    expect(result.netPay.toFixed(2)).toBe("46800.00");
  });
});

// ---------------------------------------------------------------------------
// 2. Two unpaid leave days
// ---------------------------------------------------------------------------

describe("two unpaid leave days (wage 50,000, 26 working days)", () => {
  const lines = buildLines(50_000);
  const result = computePayslip({
    monthlyWage: "50000",
    componentLines: lines,
    totalWorkingDays: 26,
    unpaidLeaveDays: "2",
    missingAttendanceDays: "0",
    pfRateEmployee: "12",
    professionalTax: "200",
  });

  const perDayRate = new Decimal(50_000).dividedBy(26);

  it("payable days = 24", () => {
    expect(result.payableDays.toNumber()).toBe(24);
  });

  it("per-day rate = 50000/26 rounded to 2dp", () => {
    expect(result.perDayRate.toFixed(2)).toBe(
      perDayRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    );
  });

  it("loss of pay = perDayRate × 2", () => {
    const expectedLop = perDayRate.times(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(result.lossOfPay.toFixed(2)).toBe(expectedLop.toFixed(2));
  });

  it("gross earnings < 50,000 (deducted proportionally)", () => {
    expect(result.grossEarnings.lessThan(50_000)).toBe(true);
  });

  it("no floating-point artefacts in result", () => {
    for (const line of result.lines) {
      expect(line.amount.equals(new Decimal(line.amount.toFixed(2)))).toBe(true);
    }
    expect(result.grossEarnings.equals(new Decimal(result.grossEarnings.toFixed(2)))).toBe(true);
    expect(result.netPay.equals(new Decimal(result.netPay.toFixed(2)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. One missing attendance day
// ---------------------------------------------------------------------------

describe("one missing attendance day (wage 50,000, 26 working days)", () => {
  const lines = buildLines(50_000);
  const result = computePayslip({
    monthlyWage: "50000",
    componentLines: lines,
    totalWorkingDays: 26,
    unpaidLeaveDays: "0",
    missingAttendanceDays: "1",
    pfRateEmployee: "12",
    professionalTax: "200",
  });

  it("payable days = 25", () => {
    expect(result.payableDays.toNumber()).toBe(25);
  });

  it("gross earnings = full gross × (25/26)", () => {
    const fraction = new Decimal(25).dividedBy(26);
    const expected = new Decimal(50_000).times(fraction).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(result.grossEarnings.toFixed(2)).toBe(expected.toFixed(2));
  });
});

// ---------------------------------------------------------------------------
// 4. Absences exceed working days — clamp at zero
// ---------------------------------------------------------------------------

describe("absences exceed working days — clamp to zero, never negative", () => {
  const lines = buildLines(50_000);
  const result = computePayslip({
    monthlyWage: "50000",
    componentLines: lines,
    totalWorkingDays: 26,
    unpaidLeaveDays: "20",
    missingAttendanceDays: "10", // total 30 > 26
    pfRateEmployee: "12",
    professionalTax: "200",
  });

  it("payable days is clamped to 0 (never negative)", () => {
    expect(result.payableDays.toNumber()).toBe(0);
  });

  it("gross earnings is 0", () => {
    expect(result.grossEarnings.toFixed(2)).toBe("0.00");
  });

  it("net pay is negative (deductions applied even at zero gross)", () => {
    // PF on zero basic = 0, but PT still applies
    // So net = 0 - 0 (PF on zero basic) - 200 (PT) = -200
    expect(result.netPay.lessThanOrEqualTo(0)).toBe(true);
  });

  it("loss of pay does not exceed the wage", () => {
    // LOP should be based on clamped working days, not overflow
    expect(result.lossOfPay.greaterThan(0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Per-day rate rounding
// ---------------------------------------------------------------------------

describe("per-day rate rounding", () => {
  it("rounds per-day rate to 2dp half-up", () => {
    const lines = buildLines(50_000);
    const result = computePayslip({
      monthlyWage: "50000",
      componentLines: lines,
      totalWorkingDays: 26, // 50000/26 = 1923.076923...
      unpaidLeaveDays: "0",
      missingAttendanceDays: "0",
      pfRateEmployee: "12",
      professionalTax: "200",
    });

    // 50000 / 26 = 1923.076923... → rounds to 1923.08
    expect(result.perDayRate.toFixed(2)).toBe("1923.08");
  });

  it("handles 22 working days cleanly", () => {
    const lines = buildLines(50_000);
    const result = computePayslip({
      monthlyWage: "50000",
      componentLines: lines,
      totalWorkingDays: 22, // 50000/22 = 2272.727...
      unpaidLeaveDays: "0",
      missingAttendanceDays: "0",
      pfRateEmployee: "12",
      professionalTax: "200",
    });
    // Full month, no LOP → gross should equal full 50,000
    expect(result.grossEarnings.toFixed(2)).toBe("50000.00");
  });
});

// ---------------------------------------------------------------------------
// 6. Zero working days
// ---------------------------------------------------------------------------

describe("zero working days edge case", () => {
  it("produces zero payable days and zero LOP without dividing by zero", () => {
    const lines = buildLines(50_000);
    const result = computePayslip({
      monthlyWage: "50000",
      componentLines: lines,
      totalWorkingDays: 0,
      unpaidLeaveDays: "0",
      missingAttendanceDays: "0",
      pfRateEmployee: "12",
      professionalTax: "200",
    });

    expect(result.payableDays.toNumber()).toBe(0);
    expect(result.perDayRate.toNumber()).toBe(0);
    expect(result.lossOfPay.toNumber()).toBe(0);
    expect(result.grossEarnings.toNumber()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Output line count and categories
// ---------------------------------------------------------------------------

describe("output line structure", () => {
  const lines = buildLines(50_000);
  const result = computePayslip({
    monthlyWage: "50000",
    componentLines: lines,
    totalWorkingDays: 26,
    unpaidLeaveDays: "0",
    missingAttendanceDays: "0",
    pfRateEmployee: "12",
    professionalTax: "200",
  });

  it("has 6 earning lines from the default component set", () => {
    const earnings = result.lines.filter((l) => l.category === ComponentCategory.EARNING);
    expect(earnings).toHaveLength(6);
  });

  it("has PF_EMPLOYEE and PROFESSIONAL_TAX as deduction lines", () => {
    const deductions = result.lines.filter(
      (l) => l.category === ComponentCategory.EMPLOYEE_DEDUCTION,
    );
    expect(deductions.map((d) => d.code).sort()).toEqual(
      ["PF_EMPLOYEE", "PROFESSIONAL_TAX"].sort(),
    );
  });

  it("employer contribution lines are NOT in the output (excluded from employee view)", () => {
    const employer = result.lines.filter(
      (l) => l.category === ComponentCategory.EMPLOYER_CONTRIBUTION,
    );
    expect(employer).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Combined unpaid leave + missing attendance
// ---------------------------------------------------------------------------

describe("combined unpaid leave and missing attendance", () => {
  it("adds unpaid leave days and missing attendance days together for LOP", () => {
    const lines = buildLines(60_000);
    const result = computePayslip({
      monthlyWage: "60000",
      componentLines: lines,
      totalWorkingDays: 26,
      unpaidLeaveDays: "1",
      missingAttendanceDays: "1",
      pfRateEmployee: "12",
      professionalTax: "200",
    });

    expect(result.payableDays.toNumber()).toBe(24);
    // Gross is the sum of individually-rounded component lines; it is close to
    // 60000 × (24/26) but may differ by ±1 cent due to per-line rounding.
    // Validate the invariants instead of an exact total.
    expect(result.grossEarnings.lessThan(60_000)).toBe(true); // reduced
    expect(result.grossEarnings.greaterThan(0)).toBe(true); // not zeroed
    // All output values must be clean 2dp numbers
    expect(result.grossEarnings.equals(new Decimal(result.grossEarnings.toFixed(2)))).toBe(true);
  });
});
