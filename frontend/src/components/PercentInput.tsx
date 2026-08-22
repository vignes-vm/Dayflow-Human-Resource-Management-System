import { forwardRef, useEffect, useState } from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface PercentInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  /** Decimal string, e.g. "8.33" — never a JS number. */
  value: string;
  onValueChange: (value: string) => void;
}

const PERCENT_PATTERN = /^\d{0,3}\.?\d{0,2}$/;

export const PercentInput = forwardRef<HTMLInputElement, PercentInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const [local, setLocal] = useState(value);

    // Resync when the value changes from outside this input (e.g. loading
    // an existing contract's components after mount) — see MoneyInput.tsx.
    useEffect(() => {
      setLocal(value);
    }, [value]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          value={local}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" || PERCENT_PATTERN.test(next)) {
              setLocal(next);
              onValueChange(next);
            }
          }}
          className={cn("tabular pr-7 text-right font-mono", className)}
          {...props}
        />
        <span className="text-ink-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm">
          %
        </span>
      </div>
    );
  },
);
PercentInput.displayName = "PercentInput";
