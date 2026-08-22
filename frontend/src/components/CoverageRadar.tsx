import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { TimeOffImpactResponse } from "@dayflow/shared";

import { cn } from "@/lib/cn";

const LEVEL_META = {
  ok: { icon: CheckCircle2, label: "OK", barClass: "bg-present", textClass: "text-present" },
  watch: { icon: AlertTriangle, label: "Watch", barClass: "bg-half", textClass: "text-half" },
  risk: { icon: ShieldAlert, label: "Risk", barClass: "bg-absent", textClass: "text-absent" },
} as const;

const FLAG_LABEL: Record<string, string> = {
  SECOND_REQUEST_THIS_MONTH: "2nd request this month",
  CROSSES_MONTH_END: "Crosses month end",
  SHORT_NOTICE: "Short notice",
  NO_CERTIFICATE_ATTACHED: "No certificate attached",
  ADJACENT_TO_HOLIDAY: "Adjacent to a holiday",
};

export function CoverageRadar({ impact }: { impact: TimeOffImpactResponse }) {
  return (
    <div className="space-y-4">
      {impact.excludedDates.length > 0 ? (
        <p className="text-ink-500 text-xs">
          Excluded: {impact.excludedDates.map((e) => `${e.date} (${e.reason})`).join(", ")}
        </p>
      ) : null}

      <div>
        <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
          Team coverage
        </p>
        <div className="flex flex-wrap gap-2">
          {impact.teamCoverage.map((day) => {
            const meta = LEVEL_META[day.level];
            const Icon = meta.icon;
            return (
              <div
                key={day.date}
                className="rounded-card border-border flex w-24 flex-col items-center gap-1 border p-2"
              >
                <span className="text-ink-500 text-[10px]">{day.date.slice(5)}</span>
                <div className="bg-ink-100 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full", meta.barClass)}
                    style={{ width: `${day.coverage}%` }}
                  />
                </div>
                <div className={cn("flex items-center gap-1 text-xs font-medium", meta.textClass)}>
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {day.coverage}%
                </div>
                <span className="text-ink-400 text-[10px]">
                  {day.away}/{day.headcount} away
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {impact.collisions.length > 0 ? (
        <div>
          <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
            Already away
          </p>
          <ul className="space-y-1 text-sm">
            {impact.collisions.map((c, i) => (
              <li key={i} className="text-ink-700">
                {c.employee}
                {c.designation ? ` · ${c.designation}` : ""} — {c.dates} ({c.status})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {impact.flags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {impact.flags.map((f) => (
            <span
              key={f}
              className="bg-warning-100 text-warning rounded-full px-2 py-0.5 text-xs font-medium"
            >
              {FLAG_LABEL[f] ?? f}
            </span>
          ))}
        </div>
      ) : null}

      {impact.allocationAfter ? (
        <p className="text-ink-500 text-xs">
          {impact.allocationAfter.type}: {impact.allocationAfter.allocated} allocated,{" "}
          {impact.allocationAfter.used} used, {impact.allocationAfter.thisRequest} this request —{" "}
          <strong>{impact.allocationAfter.remaining} remaining after</strong>
        </p>
      ) : null}
    </div>
  );
}
