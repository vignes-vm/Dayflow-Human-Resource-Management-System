import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const sharedProps = {
      ref,
      className: cn(
        buttonVariants({ variant, size }),
        "cursor-pointer disabled:cursor-not-allowed",
        className,
      ),
      disabled: disabled || loading,
      "aria-busy": loading || undefined,
      ...props,
    };

    // Slot (asChild) requires exactly one child element — it delegates
    // rendering entirely to that child, so the loading spinner (which would
    // add a second child node) is only supported in the plain <button> path.
    if (asChild) {
      return <Slot {...sharedProps}>{children}</Slot>;
    }

    return (
      <button {...sharedProps}>
        {loading ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
