import { Decimal } from "decimal.js";
import { ComponentCategory, ComponentComputation } from "@dayflow/shared";
import { pctOf, round2 } from "@/lib/money.js";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ComponentInput {
  code: string;
  label: string;
  category: ComponentCategory;
  computation: ComponentComputation;
  /** For FIXED: the fixed amount. For PCT_OF_WAGE / PCT_OF_COMPONENT: the percentage (e.g. 8.33). For BALANCE: ignored. */
  value: Decimal.Value;
  /** Only for PCT_OF_COMPONENT — the code of the component to use as the base. */
  baseComponentCode?: string | null;
}

export interface ContractInput {
  monthlyWage: Decimal.Value;
  components: ComponentInput[];
  pfRateEmployee: Decimal.Value; // percentage, e.g. 12
  pfRateEmployer: Decimal.Value; // percentage, e.g. 12
  professionalTax: Decimal.Value; // flat monthly amount
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ComputedLine {
  code: string;
  label: string;
  category: ComponentCategory;
  computation: ComponentComputation;
  /** Rounded to 2dp at output boundary */
  amount: Decimal;
}

export interface ComputedTotals {
  grossEarnings: Decimal;
  totalEmployeeDeductions: Decimal;
  totalEmployerContributions: Decimal;
  netPay: Decimal;
}

export type ContractError =
  | { type: "CIRCULAR_COMPONENT_REFERENCE"; cycle: string[] }
  | { type: "COMPONENTS_EXCEED_WAGE"; overflow: Decimal }
  | { type: "MULTIPLE_BALANCE_COMPONENTS"; codes: string[] }
  | { type: "UNKNOWN_BASE_COMPONENT"; code: string; baseCode: string };

export interface ContractResult {
  lines: ComputedLine[];
  totals: ComputedTotals;
  errors: ContractError[];
}

// ---------------------------------------------------------------------------
// Default component set (from the blueprint)
// ---------------------------------------------------------------------------

export function defaultComponentSet(): ComponentInput[] {
  return [
    {
      code: "BASIC",
      label: "Basic",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.PCT_OF_WAGE,
      value: "50",
    },
    {
      code: "HRA",
      label: "HRA",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.PCT_OF_COMPONENT,
      value: "50",
      baseComponentCode: "BASIC",
    },
    {
      code: "STANDARD_ALLOWANCE",
      label: "Standard Allowance",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.FIXED,
      value: "4567",
    },
    {
      code: "PERFORMANCE_BONUS",
      label: "Performance Bonus",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.PCT_OF_COMPONENT,
      value: "8.33",
      baseComponentCode: "BASIC",
    },
    {
      code: "LTA",
      label: "LTA",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.PCT_OF_COMPONENT,
      value: "8.33",
      baseComponentCode: "BASIC",
    },
    {
      code: "FIXED_ALLOWANCE",
      label: "Fixed Allowance",
      category: ComponentCategory.EARNING,
      computation: ComponentComputation.BALANCE,
      value: "0",
    },
  ];
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm) — returns sorted codes or the cycle
// ---------------------------------------------------------------------------

function topologicalSort(
  earningCodes: string[],
  edges: Map<string, string | null>, // code → baseComponentCode | null
): { sorted: string[] } | { cycle: string[] } {
  // Build adjacency list and in-degree count.
  // Edge direction: baseCode → dependentCode (evaluate base before dependent)
  const dependents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const code of earningCodes) {
    if (!dependents.has(code)) dependents.set(code, []);
    if (!inDegree.has(code)) inDegree.set(code, 0);
  }

  for (const code of earningCodes) {
    const base = edges.get(code);
    if (base) {
      dependents.get(base)!.push(code);
      inDegree.set(code, (inDegree.get(code) ?? 0) + 1);
    }
  }

  // Kahn's: start with all nodes with in-degree 0
  const queue: string[] = [];
  for (const code of earningCodes) {
    if (inDegree.get(code) === 0) queue.push(code);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const dep of dependents.get(node) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  if (sorted.length !== earningCodes.length) {
    // Find cycle members — nodes that never reached in-degree 0
    const cycle = earningCodes.filter((c) => (inDegree.get(c) ?? 0) > 0);
    return { cycle };
  }

  return { sorted };
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeContract(input: ContractInput): ContractResult {
  const { monthlyWage, components, pfRateEmployee, pfRateEmployer, professionalTax } = input;
  const wage = new Decimal(monthlyWage);
  const errors: ContractError[] = [];
  const lines: ComputedLine[] = [];

  // --- Separate earnings from deductions/contributions ---
  const earnings = components.filter((c) => c.category === ComponentCategory.EARNING);
  const nonEarnings = components.filter((c) => c.category !== ComponentCategory.EARNING);

  // --- Validate: exactly one BALANCE component ---
  const balanceComps = earnings.filter((c) => c.computation === ComponentComputation.BALANCE);
  if (balanceComps.length > 1) {
    errors.push({ type: "MULTIPLE_BALANCE_COMPONENTS", codes: balanceComps.map((c) => c.code) });
    return { lines, totals: emptyTotals(), errors };
  }

  // --- Validate: all baseComponentCode references point to known earning codes ---
  const earningCodeSet = new Set(earnings.map((c) => c.code));
  for (const comp of earnings) {
    if (
      comp.computation === ComponentComputation.PCT_OF_COMPONENT &&
      comp.baseComponentCode &&
      !earningCodeSet.has(comp.baseComponentCode)
    ) {
      errors.push({
        type: "UNKNOWN_BASE_COMPONENT",
        code: comp.code,
        baseCode: comp.baseComponentCode,
      });
    }
  }
  if (errors.length > 0) return { lines, totals: emptyTotals(), errors };

  // --- Topological sort to find evaluation order (exclude BALANCE — evaluated last) ---
  const nonBalanceEarnings = earnings.filter((c) => c.computation !== ComponentComputation.BALANCE);
  const edgeMap = new Map<string, string | null>(
    nonBalanceEarnings.map((c) => [
      c.code,
      c.computation === ComponentComputation.PCT_OF_COMPONENT
        ? (c.baseComponentCode ?? null)
        : null,
    ]),
  );

  const sortResult = topologicalSort(
    nonBalanceEarnings.map((c) => c.code),
    edgeMap,
  );

  if ("cycle" in sortResult) {
    errors.push({ type: "CIRCULAR_COMPONENT_REFERENCE", cycle: sortResult.cycle });
    return { lines, totals: emptyTotals(), errors };
  }

  const sortedCodes = sortResult.sorted;
  const compByCode = new Map<string, ComponentInput>(earnings.map((c) => [c.code, c]));

  // --- Evaluate each earning component in topological order ---
  // Full precision internally; round only at output boundary.
  const resolvedAmounts = new Map<string, Decimal>(); // full precision

  for (const code of sortedCodes) {
    const comp = compByCode.get(code)!;
    let amount: Decimal;

    switch (comp.computation) {
      case ComponentComputation.FIXED:
        amount = new Decimal(comp.value);
        break;
      case ComponentComputation.PCT_OF_WAGE:
        amount = pctOf(wage, comp.value);
        break;
      case ComponentComputation.PCT_OF_COMPONENT: {
        const base = resolvedAmounts.get(comp.baseComponentCode!);
        if (!base) {
          // Should have been caught by validation above, but guard anyway
          errors.push({
            type: "UNKNOWN_BASE_COMPONENT",
            code: comp.code,
            baseCode: comp.baseComponentCode!,
          });
          return { lines, totals: emptyTotals(), errors };
        }
        amount = pctOf(base, comp.value);
        break;
      }
      case ComponentComputation.BALANCE:
        // Computed after the loop
        amount = new Decimal(0);
        break;
    }

    resolvedAmounts.set(code, amount);
  }

  // --- Compute BALANCE ---
  const sumNonBalance = [...resolvedAmounts.values()].reduce(
    (acc, v) => acc.plus(v),
    new Decimal(0),
  );

  let balanceAmount = new Decimal(0);
  if (balanceComps.length === 1) {
    balanceAmount = wage.minus(sumNonBalance);

    if (balanceAmount.lessThan(0)) {
      errors.push({
        type: "COMPONENTS_EXCEED_WAGE",
        overflow: round2(balanceAmount.abs()),
      });
      return { lines, totals: emptyTotals(), errors };
    }

    resolvedAmounts.set(balanceComps[0]!.code, balanceAmount);
  } else {
    // No BALANCE component — check if total exceeds wage
    if (sumNonBalance.greaterThan(wage)) {
      errors.push({
        type: "COMPONENTS_EXCEED_WAGE",
        overflow: round2(sumNonBalance.minus(wage)),
      });
      return { lines, totals: emptyTotals(), errors };
    }
  }

  // --- Build earning output lines (in original input order, with BALANCE last among earnings) ---
  const earningOrder = [
    ...earnings.filter((c) => c.computation !== ComponentComputation.BALANCE),
    ...balanceComps,
  ];

  // Sort earning lines by the topological order, then BALANCE at end
  const sortedOrderedEarnings = sortedCodes
    .map((code) => compByCode.get(code)!)
    .concat(balanceComps);

  for (const comp of sortedOrderedEarnings) {
    const raw = resolvedAmounts.get(comp.code) ?? new Decimal(0);
    lines.push({
      code: comp.code,
      label: comp.label,
      category: comp.category,
      computation: comp.computation,
      amount: round2(raw),
    });
  }

  // --- PF (employee + employer) — computed from BASIC ---
  const basicAmount = resolvedAmounts.get("BASIC") ?? new Decimal(0);
  const pfEmployee = round2(pctOf(basicAmount, pfRateEmployee));
  const pfEmployer = round2(pctOf(basicAmount, pfRateEmployer));
  const pt = round2(new Decimal(professionalTax));

  lines.push({
    code: "PF_EMPLOYEE",
    label: "Provident Fund (Employee)",
    category: ComponentCategory.EMPLOYEE_DEDUCTION,
    computation: ComponentComputation.PCT_OF_COMPONENT,
    amount: pfEmployee,
  });

  lines.push({
    code: "PROFESSIONAL_TAX",
    label: "Professional Tax",
    category: ComponentCategory.EMPLOYEE_DEDUCTION,
    computation: ComponentComputation.FIXED,
    amount: pt,
  });

  lines.push({
    code: "PF_EMPLOYER",
    label: "Provident Fund (Employer)",
    category: ComponentCategory.EMPLOYER_CONTRIBUTION,
    computation: ComponentComputation.PCT_OF_COMPONENT,
    amount: pfEmployer,
  });

  // --- Add non-earning components that were in the input (custom deductions) ---
  for (const comp of nonEarnings) {
    // Skip the PF/PT we just added if they were in the input — engine always derives them
    if (["PF_EMPLOYEE", "PROFESSIONAL_TAX", "PF_EMPLOYER"].includes(comp.code)) continue;

    const raw =
      comp.computation === ComponentComputation.FIXED
        ? new Decimal(comp.value)
        : comp.computation === ComponentComputation.PCT_OF_WAGE
          ? pctOf(wage, comp.value)
          : new Decimal(comp.value);

    lines.push({
      code: comp.code,
      label: comp.label,
      category: comp.category,
      computation: comp.computation,
      amount: round2(raw),
    });
  }

  // --- Totals ---
  const grossEarnings = round2(
    lines
      .filter((l) => l.category === ComponentCategory.EARNING)
      .reduce((acc, l) => acc.plus(l.amount), new Decimal(0)),
  );

  const totalEmployeeDeductions = round2(
    lines
      .filter((l) => l.category === ComponentCategory.EMPLOYEE_DEDUCTION)
      .reduce((acc, l) => acc.plus(l.amount), new Decimal(0)),
  );

  const totalEmployerContributions = round2(
    lines
      .filter((l) => l.category === ComponentCategory.EMPLOYER_CONTRIBUTION)
      .reduce((acc, l) => acc.plus(l.amount), new Decimal(0)),
  );

  const netPay = round2(grossEarnings.minus(totalEmployeeDeductions));

  return {
    lines,
    totals: { grossEarnings, totalEmployeeDeductions, totalEmployerContributions, netPay },
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyTotals(): ComputedTotals {
  const zero = new Decimal(0);
  return {
    grossEarnings: zero,
    totalEmployeeDeductions: zero,
    totalEmployerContributions: zero,
    netPay: zero,
  };
}
