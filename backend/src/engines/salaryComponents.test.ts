import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import { computeContract, defaultComponentSet, type ComponentInput } from "./salaryComponents.js";
import { ComponentCategory, ComponentComputation } from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_RATES = {
  pfRateEmployee: "12",
  pfRateEmployer: "12",
  professionalTax: "200",
} as const;

function runDefault(wage: string | number) {
  return computeContract({
    monthlyWage: String(wage),
    components: defaultComponentSet(),
    ...DEFAULT_RATES,
  });
}

// ---------------------------------------------------------------------------
// 1. Default component set — wage 50,000
// ---------------------------------------------------------------------------

describe("default component set — wage 50,000", () => {
  const result = runDefault(50_000);

  it("returns no errors", () => {
    expect(result.errors).toHaveLength(0);
  });

  it("Basic = 25,000.00", () => {
    const basic = result.lines.find((l) => l.code === "BASIC");
    expect(basic?.amount.toFixed(2)).toBe("25000.00");
  });

  it("HRA = 12,500.00", () => {
    const hra = result.lines.find((l) => l.code === "HRA");
    expect(hra?.amount.toFixed(2)).toBe("12500.00");
  });

  it("Standard Allowance = 4,567.00", () => {
    const std = result.lines.find((l) => l.code === "STANDARD_ALLOWANCE");
    expect(std?.amount.toFixed(2)).toBe("4567.00");
  });

  it("Performance Bonus = 2,082.50", () => {
    const bonus = result.lines.find((l) => l.code === "PERFORMANCE_BONUS");
    expect(bonus?.amount.toFixed(2)).toBe("2082.50");
  });

  it("LTA = 2,082.50", () => {
    const lta = result.lines.find((l) => l.code === "LTA");
    expect(lta?.amount.toFixed(2)).toBe("2082.50");
  });

  it("Fixed Allowance (BALANCE) = 3,768.00", () => {
    const fa = result.lines.find((l) => l.code === "FIXED_ALLOWANCE");
    expect(fa?.amount.toFixed(2)).toBe("3768.00");
  });

  it("gross earnings total is exactly 50,000.00", () => {
    expect(result.totals.grossEarnings.toFixed(2)).toBe("50000.00");
  });

  it("PF employee = 3,000.00 (12% of Basic 25,000)", () => {
    const pf = result.lines.find((l) => l.code === "PF_EMPLOYEE");
    expect(pf?.amount.toFixed(2)).toBe("3000.00");
  });

  it("PF employer = 3,000.00", () => {
    const pf = result.lines.find((l) => l.code === "PF_EMPLOYER");
    expect(pf?.amount.toFixed(2)).toBe("3000.00");
  });

  it("Professional Tax = 200.00 (flat)", () => {
    const pt = result.lines.find((l) => l.code === "PROFESSIONAL_TAX");
    expect(pt?.amount.toFixed(2)).toBe("200.00");
  });

  it("no floating-point artefacts (e.g. 2082.4999999)", () => {
    for (const line of result.lines) {
      // Verify the stored value equals its own 2dp representation exactly
      expect(line.amount.equals(new Decimal(line.amount.toFixed(2)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Default component set — wage 60,000
// ---------------------------------------------------------------------------

describe("default component set — wage 60,000", () => {
  const result = runDefault(60_000);

  it("returns no errors", () => {
    expect(result.errors).toHaveLength(0);
  });

  it("Basic = 30,000.00 (50% of 60k)", () => {
    const basic = result.lines.find((l) => l.code === "BASIC");
    expect(basic?.amount.toFixed(2)).toBe("30000.00");
  });

  it("HRA = 15,000.00 (50% of Basic)", () => {
    const hra = result.lines.find((l) => l.code === "HRA");
    expect(hra?.amount.toFixed(2)).toBe("15000.00");
  });

  it("Standard Allowance = 4,567.00 (FIXED, unchanged)", () => {
    const std = result.lines.find((l) => l.code === "STANDARD_ALLOWANCE");
    expect(std?.amount.toFixed(2)).toBe("4567.00");
  });

  it("gross earnings total is exactly 60,000.00", () => {
    expect(result.totals.grossEarnings.toFixed(2)).toBe("60000.00");
  });

  it("PF employee = 3,600.00 (12% of Basic 30,000)", () => {
    const pf = result.lines.find((l) => l.code === "PF_EMPLOYEE");
    expect(pf?.amount.toFixed(2)).toBe("3600.00");
  });

  it("no floating-point artefacts", () => {
    for (const line of result.lines) {
      expect(line.amount.equals(new Decimal(line.amount.toFixed(2)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. COMPONENTS_EXCEED_WAGE error
// ---------------------------------------------------------------------------

describe("COMPONENTS_EXCEED_WAGE", () => {
  it("returns the error when non-balance earnings exceed the wage", () => {
    const components: ComponentInput[] = [
      {
        code: "BASIC",
        label: "Basic",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.FIXED,
        value: "60000", // exceeds wage
      },
      {
        code: "FIXED_ALLOWANCE",
        label: "Fixed Allowance",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.BALANCE,
        value: "0",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.type).toBe("COMPONENTS_EXCEED_WAGE");
    if (result.errors[0]?.type === "COMPONENTS_EXCEED_WAGE") {
      expect(result.errors[0].overflow.toFixed(2)).toBe("10000.00");
    }
  });

  it("returns the error when PCT components collectively exceed the wage (no BALANCE)", () => {
    const components: ComponentInput[] = [
      {
        code: "COMP_A",
        label: "Comp A",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_WAGE,
        value: "80",
      },
      {
        code: "COMP_B",
        label: "Comp B",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_WAGE,
        value: "40",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors[0]?.type).toBe("COMPONENTS_EXCEED_WAGE");
  });
});

// ---------------------------------------------------------------------------
// 4. CIRCULAR_COMPONENT_REFERENCE error
// ---------------------------------------------------------------------------

describe("CIRCULAR_COMPONENT_REFERENCE", () => {
  it("detects A → B → A cycle", () => {
    const components: ComponentInput[] = [
      {
        code: "COMP_A",
        label: "A",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "10",
        baseComponentCode: "COMP_B",
      },
      {
        code: "COMP_B",
        label: "B",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "10",
        baseComponentCode: "COMP_A",
      },
      {
        code: "FIXED_ALLOWANCE",
        label: "Fixed Allowance",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.BALANCE,
        value: "0",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.type).toBe("CIRCULAR_COMPONENT_REFERENCE");
    if (result.errors[0]?.type === "CIRCULAR_COMPONENT_REFERENCE") {
      expect(result.errors[0].cycle).toContain("COMP_A");
      expect(result.errors[0].cycle).toContain("COMP_B");
    }
  });

  it("detects A → B → C → A three-node cycle", () => {
    const components: ComponentInput[] = [
      {
        code: "A",
        label: "A",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "10",
        baseComponentCode: "C",
      },
      {
        code: "B",
        label: "B",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "10",
        baseComponentCode: "A",
      },
      {
        code: "C",
        label: "C",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "10",
        baseComponentCode: "B",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors[0]?.type).toBe("CIRCULAR_COMPONENT_REFERENCE");
  });
});

// ---------------------------------------------------------------------------
// 5. UNKNOWN_BASE_COMPONENT
// ---------------------------------------------------------------------------

describe("UNKNOWN_BASE_COMPONENT", () => {
  it("returns error when baseComponentCode references a non-existent component", () => {
    const components: ComponentInput[] = [
      {
        code: "HRA",
        label: "HRA",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_COMPONENT,
        value: "50",
        baseComponentCode: "NON_EXISTENT",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors[0]?.type).toBe("UNKNOWN_BASE_COMPONENT");
  });
});

// ---------------------------------------------------------------------------
// 6. MULTIPLE_BALANCE_COMPONENTS
// ---------------------------------------------------------------------------

describe("MULTIPLE_BALANCE_COMPONENTS", () => {
  it("returns error when more than one BALANCE component exists", () => {
    const components: ComponentInput[] = [
      {
        code: "BAL_1",
        label: "Balance 1",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.BALANCE,
        value: "0",
      },
      {
        code: "BAL_2",
        label: "Balance 2",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.BALANCE,
        value: "0",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors[0]?.type).toBe("MULTIPLE_BALANCE_COMPONENTS");
  });
});

// ---------------------------------------------------------------------------
// 7. Category classification of output lines
// ---------------------------------------------------------------------------

describe("output line categories", () => {
  const result = runDefault(50_000);

  it("all earning components are categorised as EARNING", () => {
    const earningCodes = [
      "BASIC",
      "HRA",
      "STANDARD_ALLOWANCE",
      "PERFORMANCE_BONUS",
      "LTA",
      "FIXED_ALLOWANCE",
    ];
    for (const code of earningCodes) {
      const line = result.lines.find((l) => l.code === code);
      expect(line?.category).toBe(ComponentCategory.EARNING);
    }
  });

  it("PF_EMPLOYEE is EMPLOYEE_DEDUCTION", () => {
    const line = result.lines.find((l) => l.code === "PF_EMPLOYEE");
    expect(line?.category).toBe(ComponentCategory.EMPLOYEE_DEDUCTION);
  });

  it("PF_EMPLOYER is EMPLOYER_CONTRIBUTION", () => {
    const line = result.lines.find((l) => l.code === "PF_EMPLOYER");
    expect(line?.category).toBe(ComponentCategory.EMPLOYER_CONTRIBUTION);
  });
});

// ---------------------------------------------------------------------------
// 8. Zero PF rate
// ---------------------------------------------------------------------------

describe("zero PF rate", () => {
  it("produces zero PF lines", () => {
    const result = computeContract({
      monthlyWage: "50000",
      components: defaultComponentSet(),
      pfRateEmployee: "0",
      pfRateEmployer: "0",
      professionalTax: "0",
    });

    const pfEmp = result.lines.find((l) => l.code === "PF_EMPLOYEE");
    const pfEr = result.lines.find((l) => l.code === "PF_EMPLOYER");
    expect(pfEmp?.amount.toFixed(2)).toBe("0.00");
    expect(pfEr?.amount.toFixed(2)).toBe("0.00");
    expect(result.totals.netPay.equals(result.totals.grossEarnings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Wage exactly matching non-balance sum (zero BALANCE)
// ---------------------------------------------------------------------------

describe("zero balance allowance", () => {
  it("BALANCE = 0 when non-balance earnings exactly equal the wage", () => {
    const components: ComponentInput[] = [
      {
        code: "BASIC",
        label: "Basic",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.PCT_OF_WAGE,
        value: "100", // 100% of wage
      },
      {
        code: "FIXED_ALLOWANCE",
        label: "Fixed Allowance",
        category: ComponentCategory.EARNING,
        computation: ComponentComputation.BALANCE,
        value: "0",
      },
    ];

    const result = computeContract({
      monthlyWage: "50000",
      components,
      ...DEFAULT_RATES,
    });

    expect(result.errors).toHaveLength(0);
    const fa = result.lines.find((l) => l.code === "FIXED_ALLOWANCE");
    expect(fa?.amount.toFixed(2)).toBe("0.00");
    expect(result.totals.grossEarnings.toFixed(2)).toBe("50000.00");
  });
});
