import { AlertOctagon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "That didn't work. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-card border-danger-100 bg-danger-100/40 flex flex-col items-center justify-center gap-3 border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-danger-100 flex h-12 w-12 items-center justify-center rounded-full">
        <AlertOctagon className="text-danger h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-display text-ink-900 text-base font-semibold">{title}</p>
        <p className="text-ink-500 max-w-sm text-sm">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
