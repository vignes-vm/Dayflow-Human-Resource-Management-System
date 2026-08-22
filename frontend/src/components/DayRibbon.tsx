import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/cn";

export interface DayRibbonSession {
  inAt: string | Date;
  outAt: string | Date | null;
}

const STATUS_CLASS: Record<string, string> = {
  PRESENT: "bg-present",
  HALF_DAY: "bg-half",
  ON_LEAVE: "bg-leave",
  ABSENT: "bg-absent",
  HOLIDAY: "bg-ink-300",
  WEEKEND: "bg-ink-200",
};

export interface DayRibbonProps {
  date: string | Date;
  status: string;
  sessions: DayRibbonSession[];
  /** Window shown, as "HH:mm", defaults to a 9-to-18 workday. */
  expectedStart?: string;
  expectedEnd?: string;
  editedBy?: string | null;
  className?: string;
  /** Compact variant for the employee card grid. */
  compact?: boolean;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function DayRibbon({
  status,
  sessions,
  expectedStart = "09:00",
  expectedEnd = "18:00",
  editedBy,
  className,
  compact,
}: DayRibbonProps) {
  const prefersReducedMotion = useReducedMotion();
  const windowStart = toMinutes(expectedStart);
  const windowEnd = toMinutes(expectedEnd);
  const windowSpan = Math.max(1, windowEnd - windowStart);

  const segments = sessions.map((s, i) => {
    const inAt = new Date(s.inAt);
    const outAt = s.outAt ? new Date(s.outAt) : new Date();
    const startPct = Math.max(
      0,
      Math.min(100, ((minutesSinceMidnight(inAt) - windowStart) / windowSpan) * 100),
    );
    const endPct = Math.max(
      0,
      Math.min(100, ((minutesSinceMidnight(outAt) - windowStart) / windowSpan) * 100),
    );
    return { key: i, startPct, widthPct: Math.max(0, endPct - startPct), open: !s.outAt };
  });

  return (
    <div
      className={cn("group relative", className)}
      title={editedBy ? `Edited by ${editedBy}` : undefined}
    >
      <div
        className={cn(
          "bg-ink-100 relative overflow-hidden rounded-full",
          compact ? "h-1.5 w-full" : "h-3 w-full",
        )}
      >
        {segments.map((seg) => (
          <motion.div
            key={seg.key}
            initial={{ width: 0 }}
            animate={{ width: `${seg.widthPct}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.32, delay: seg.key * 0.04, ease: [0.2, 0.8, 0.2, 1] }
            }
            className={cn(
              "absolute top-0 h-full rounded-full",
              STATUS_CLASS[status] ?? "bg-ink-300",
              seg.open && !prefersReducedMotion ? "animate-pulse" : "",
            )}
            style={{ left: `${seg.startPct}%` }}
          />
        ))}
        {editedBy ? (
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)",
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}
