import { Decimal } from "decimal.js";
import { pctOf, round2, sub } from "@/lib/money.js";
import type { ComputedLine } from "./salaryComponents.js";
import { ComponentCategory } from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface PayslipInput {
  monthlyWage: Decimal.Value;
  /** The frozen component lines from the contract (category + amount already computed) */
  componentLines: ComputedLine[];
  /** Total calendar working days for the month (excluding weekends & holidays) */
  totalWorkingDays: number;
  /** Approved UNPAID leave days taken during this month */
  unpaidLeaveDays: Decimal.Value;
  /** Days with ABSENT attendance status and no covering approved leave */
  missingAttendanceDays: Decimal.Value;
  /** PF employee deduction rate as a percentage (e.g. 12) */
  pfRateEmployee: Decimal.Value;
  /** Flat professional tax for the month */
  professionalTax: Decimal.Value;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface PayslipLine {
  code: string;
  label: string;
  category: ComponentCategory;
  /** Rounded to 2dp */
  amount: Decimal;
}

export interface PayslipResult {
  payableDays: Decimal;
  perDayRate: Decimal;
  lossOfPay: Decimal;
  grossEarnings: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  lines: PayslipLine[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function computePayslip(input: PayslipInput): PayslipResult {
  const {
    monthlyWage,
    componentLines,
    totalWorkingDays,
    unpaidLeaveDays,
    missingAttendanceDays,
    pfRateEmployee,
    professionalTax,
  } = input;

  const wage = new Decimal(monthlyWage);
  const unpaid = new Decimal(unpaidLeaveDays);
  const missing = new Decimal(missingAttendanceDays);
  const workingDays = new Decimal(totalWorkingDays);

  // --- Per-day rate ---
  // Avoid division by zero — if working days is zero, everything is zero.
  const perDayRate = workingDays.isZero() ? new Decimal(0) : wage.dividedBy(workingDays);

  // --- Loss of Pay (LOP) ---
  const lopDays = unpaid.plus(missing);
  const lossOfPay = workingDays.isZero() ? new Decimal(0) : perDayRate.times(lopDays);

  // --- Payable days (clamp at 0, never negative) ---
  const rawPayableDays = workingDays.minus(lopDays);
  const payableDays = rawPayableDays.lessThan(0) ? new Decimal(0) : rawPayableDays;

  // --- Attendance fraction: payableDays / totalWorkingDays ---
  const attendanceFraction = workingDays.isZero()
    ? new Decimal(0)
    : payableDays.dividedBy(workingDays);

  // --- Scale each earning component by the attendance fraction ---
  // Carry full Decimal precision; round only at output.
  const earningLines = componentLines.filter((l) => l.category === ComponentCategory.EARNING);

  const scaledEarningLines: PayslipLine[] = earningLines.map((line) => ({
    code: line.code,
    label: line.label,
    category: line.category,
    amount: round2(new Decimal(line.amount).times(attendanceFraction)),
  }));

  // --- Gross earnings ---
  const grossEarnings = round2(
    scaledEarningLines.reduce((acc, l) => acc.plus(l.amount), new Decimal(0)),
  );

  // --- Deductions ---
  // PF employee: % of the scaled Basic amount (or the full Basic if no Basic line found)
  const basicLine = scaledEarningLines.find((l) => l.code === "BASIC");
  const basicAmount = basicLine ? new Decimal(basicLine.amount) : new Decimal(0);
  const pfEmployee = round2(pctOf(basicAmount, pfRateEmployee));
  const pt = round2(new Decimal(professionalTax));

  const deductionLines: PayslipLine[] = [
    {
      code: "PF_EMPLOYEE",
      label: "Provident Fund (Employee)",
      category: ComponentCategory.EMPLOYEE_DEDUCTION,
      amount: pfEmployee,
    },
    {
      code: "PROFESSIONAL_TAX",
      label: "Professional Tax",
      category: ComponentCategory.EMPLOYEE_DEDUCTION,
      amount: pt,
    },
  ];

  // --- Pass through any non-EARNING, non-EMPLOYER_CONTRIBUTION lines from the contract
  //     (in case there are custom employee deductions beyond PF & PT) ---
  const existingDeductionCodes = new Set(["PF_EMPLOYEE", "PROFESSIONAL_TAX"]);
  const extraDeductionLines: PayslipLine[] = componentLines
    .filter(
      (l) =>
        l.category === ComponentCategory.EMPLOYEE_DEDUCTION && !existingDeductionCodes.has(l.code),
    )
    .map((l) => ({
      code: l.code,
      label: l.label,
      category: l.category,
      amount: round2(new Decimal(l.amount)),
    }));

  const allDeductionLines = [...deductionLines, ...extraDeductionLines];

  const totalDeductions = round2(
    allDeductionLines.reduce((acc, l) => acc.plus(l.amount), new Decimal(0)),
  );

  // --- Net Pay ---
  const netPay = round2(grossEarnings.minus(totalDeductions));

  // --- All lines (earnings + deductions, employer contributions excluded from employee view) ---
  const allLines: PayslipLine[] = [...scaledEarningLines, ...allDeductionLines];

  return {
    payableDays: round2(payableDays),
    perDayRate: round2(perDayRate),
    lossOfPay: round2(lossOfPay),
    grossEarnings,
    totalDeductions,
    netPay,
    lines: allLines,
  };
}
