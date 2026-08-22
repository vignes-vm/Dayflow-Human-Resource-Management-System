import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  delta?: { value: string; direction: "up" | "down" | "flat"; positiveIsGood?: boolean };
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, delta, loading, className }: StatCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-card border-border bg-surface border p-4", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-7 w-16" />
      </div>
    );
  }

  const deltaGood =
    delta &&
    (delta.direction === "flat"
      ? undefined
      : (delta.direction === "up") === (delta.positiveIsGood ?? true));

  return (
    <div className={cn("rounded-card border-border bg-surface border p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-500 text-sm">{label}</span>
        {Icon ? <Icon className="text-ink-400 h-4 w-4" aria-hidden="true" /> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-ink-900 font-mono text-2xl font-medium">{value}</span>
        {delta ? (
          <span
            className={cn(
              "text-xs font-medium",
              deltaGood === undefined ? "text-ink-500" : deltaGood ? "text-success" : "text-danger",
            )}
          >
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "→"} {delta.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
