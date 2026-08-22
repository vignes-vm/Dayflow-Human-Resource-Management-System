import type { SalaryComponentInput } from "@dayflow/shared";

import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";
import { cn } from "@/lib/cn";

export interface ComputedLine {
  code: string;
  label: string;
  category: "EARNING" | "EMPLOYEE_DEDUCTION" | "EMPLOYER_CONTRIBUTION";
  computation: "FIXED" | "PCT_OF_WAGE" | "PCT_OF_COMPONENT" | "BALANCE";
  amount: string;
}

const COMPUTATION_LABEL: Record<ComputedLine["computation"], string> = {
  FIXED: "fixed",
  PCT_OF_WAGE: "% of wage",
  PCT_OF_COMPONENT: "% of component",
  BALANCE: "balance",
};

function formatMoney(amount: string) {
  const n = Number(amount);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
}

/**
 * Renders the earnings/deductions breakdown. In editable mode, `components`
 * (the editable input rows minus derived PF/PT) are shown with live-computed
 * amounts from `lines` (the /contracts/preview response) alongside them.
 */
export function ComponentTable({
  lines,
  editable,
  components,
  onComponentChange,
  wage,
}: {
  lines: ComputedLine[];
  wage: string;
  editable?: boolean;
  components?: SalaryComponentInput[];
  onComponentChange?: (index: number, patch: Partial<SalaryComponentInput>) => void;
}) {
  const earnings = lines.filter((l) => l.category === "EARNING");
  const employeeDeductions = lines.filter((l) => l.category === "EMPLOYEE_DEDUCTION");
  const employerContributions = lines.filter((l) => l.category === "EMPLOYER_CONTRIBUTION");
  const earningsTotal = earnings.reduce((sum, l) => sum + Number(l.amount), 0);
  const wageNum = Number(wage) || 0;
  const matches = Math.abs(earningsTotal - wageNum) < 0.01;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
          Salary components
        </p>
        <div className="divide-border rounded-card border-border divide-y border">
          {earnings.map((line) => {
            const idx = components?.findIndex((c) => c.code === line.code) ?? -1;
            const row = idx >= 0 ? components![idx] : undefined;
            return (
              <div
                key={line.code}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5"
              >
                <span className="text-ink-900 text-sm">{line.label}</span>
                <span className="tabular text-ink-900 w-32 text-right font-mono text-sm">
                  {formatMoney(line.amount)} ₹/month
                </span>
                {editable && row && line.computation !== "BALANCE" ? (
                  <div className="w-28">
                    {row.computation === "FIXED" ? (
                      <MoneyInput
                        value={row.value}
                        onValueChange={(v) => onComponentChange?.(idx, { value: v })}
                      />
                    ) : (
                      <PercentInput
                        value={row.value}
                        onValueChange={(v) => onComponentChange?.(idx, { value: v })}
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-ink-400 w-28 text-right text-xs">
                    {COMPUTATION_LABEL[line.computation]}
                  </span>
                )}
              </div>
            );
          })}
          <div
            className={cn(
              "flex items-center justify-between px-4 py-2.5 text-sm font-semibold",
              matches ? "text-ink-900" : "text-danger",
            )}
          >
            <span>Total earnings</span>
            <span className="tabular font-mono">
              {formatMoney(String(earningsTotal))}{" "}
              {matches
                ? "✓ matches wage"
                : `— ${earningsTotal > wageNum ? "exceeds" : "short of"} wage by ₹${formatMoney(
                    String(Math.abs(earningsTotal - wageNum)),
                  )}`}
            </span>
          </div>
        </div>
      </div>

      {employeeDeductions.length || employerContributions.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {employerContributions.length ? (
            <div>
              <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
                Provident fund
              </p>
              <div className="rounded-card border-border space-y-1.5 border p-3 text-sm">
                {employerContributions.map((l) => (
                  <div key={l.code} className="flex justify-between">
                    <span className="text-ink-700">{l.label}</span>
                    <span className="tabular font-mono">₹{formatMoney(l.amount)}</span>
                  </div>
                ))}
                {employeeDeductions
                  .filter((l) => l.code === "PF_EMPLOYEE")
                  .map((l) => (
                    <div key={l.code} className="flex justify-between">
                      <span className="text-ink-700">Employee</span>
                      <span className="tabular font-mono">₹{formatMoney(l.amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
              Tax deductions
            </p>
            <div className="rounded-card border-border space-y-1.5 border p-3 text-sm">
              {employeeDeductions
                .filter((l) => l.code !== "PF_EMPLOYEE")
                .map((l) => (
                  <div key={l.code} className="flex justify-between">
                    <span className="text-ink-700">{l.label}</span>
                    <span className="tabular font-mono">₹{formatMoney(l.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
