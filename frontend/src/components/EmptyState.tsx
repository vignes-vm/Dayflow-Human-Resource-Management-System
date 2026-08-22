import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-card border-border bg-surface flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-ink-100 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="text-ink-400 h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-display text-ink-900 text-base font-semibold">{title}</p>
        {description ? <p className="text-ink-500 max-w-sm text-sm">{description}</p> : null}
      </div>
      {action ? (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
