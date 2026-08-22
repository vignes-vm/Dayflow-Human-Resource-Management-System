import * as React from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "rounded-card border-border bg-surface text-ink-900 font-body placeholder:text-ink-400 duration-fast flex h-10 w-full border px-3 py-2 text-sm transition-colors",
          "focus-visible:ring-focusRing focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-danger focus-visible:ring-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
