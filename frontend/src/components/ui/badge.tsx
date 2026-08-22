import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium font-body transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border bg-ink-100 text-ink-700",
        primary: "border-transparent bg-primary-100 text-primary-600",
        success: "border-transparent bg-success-100 text-success",
        warning: "border-transparent bg-warning-100 text-warning",
        danger: "border-transparent bg-danger-100 text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
