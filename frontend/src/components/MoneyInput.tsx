import { forwardRef, useEffect, useState } from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export interface MoneyInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  /** Decimal string, e.g. "50000.00" — never a JS number, to avoid float drift. */
  value: string;
  onValueChange: (value: string) => void;
  currencySymbol?: string;
}

const DECIMAL_PATTERN = /^\d*\.?\d{0,2}$/;

/**
 * Controlled, decimal-safe money field. Keeps the raw string the user typed
 * (no parseFloat round-tripping) so keystrokes never introduce float drift —
 * the caller is responsible for parsing with decimal.js at submit time.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, currencySymbol = "₹", className, ...props }, ref) => {
    const [local, setLocal] = useState(value);

    // Resync when the value changes for reasons other than this input's own
    // typing — e.g. a derived/disabled field (Yearly wage) recomputing from
    // another field, or async data (an existing contract's wage) arriving
    // after this component already mounted with an empty initial value.
    useEffect(() => {
      setLocal(value);
    }, [value]);

    const display = local;

    return (
      <div className="relative">
        <span className="text-ink-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm">
          {currencySymbol}
        </span>
        <Input
          ref={ref}
          inputMode="decimal"
          value={display}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" || DECIMAL_PATTERN.test(next)) {
              setLocal(next);
              onValueChange(next);
            }
          }}
          className={cn("tabular pl-7 text-right font-mono", className)}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
