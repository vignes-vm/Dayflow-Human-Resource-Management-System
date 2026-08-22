import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "primary";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-100 text-success",
  warning: "bg-warning-100 text-warning",
  danger: "bg-danger-100 text-danger",
  neutral: "bg-ink-100 text-ink-600",
  primary: "bg-primary-100 text-primary-600",
};

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Clock,
  primary: Clock,
};

export interface StatusPillProps {
  label: string;
  tone: StatusTone;
  className?: string;
  icon?: LucideIcon;
}

/** Status pills always pair colour with an icon and text — never colour alone. */
export function StatusPill({ label, tone, className, icon }: StatusPillProps) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span
      className={cn(
        "font-body inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
