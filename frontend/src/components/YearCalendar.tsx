import { useMemo } from "react";

import { cn } from "@/lib/cn";

export interface YearCalendarDay {
  date: string; // YYYY-MM-DD
  typeCode: string;
  colorToken: string | null;
  status: string;
  requestId: string;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TYPE_CLASS: Record<string, string> = {
  PAID: "bg-primary-500",
  SICK: "bg-warning",
  UNPAID: "bg-ink-400",
};

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = first.getUTCDay();
  const cells: (number | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export function YearCalendar({
  year,
  days,
  onDayClick,
}: {
  year: number;
  days: YearCalendarDay[];
  onDayClick?: (day: YearCalendarDay) => void;
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, month) => {
          const cells = buildMonthGrid(year, month);
          return (
            <div key={month} className="rounded-card border-border bg-surface border p-3">
              <p className="font-display text-ink-900 mb-2 text-sm font-semibold">
                {MONTH_NAMES[month]}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const entry = byDate.get(iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      title={entry ? `${entry.typeCode} — ${entry.status}` : undefined}
                      onClick={() => entry && onDayClick?.(entry)}
                      className={cn(
                        "text-ink-500 focus-visible:ring-focusRing flex h-6 w-6 items-center justify-center rounded-full text-[10px] focus-visible:outline-none focus-visible:ring-2",
                        entry
                          ? cn(
                              TYPE_CLASS[entry.typeCode] ?? "bg-ink-300",
                              "text-white",
                              entry.status === "TO_APPROVE" && "opacity-60",
                            )
                          : "hover:bg-ink-100",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs">
        <LegendItem colorClass="bg-primary-500" label="Paid Time Off" />
        <LegendItem colorClass="bg-warning" label="Sick Leave" />
        <LegendItem colorClass="bg-ink-400" label="Unpaid Leave" />
        <LegendItem colorClass="bg-primary-500 opacity-60" label="Pending" />
      </div>
    </div>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
      <span className="text-ink-600">{label}</span>
    </div>
  );
}
