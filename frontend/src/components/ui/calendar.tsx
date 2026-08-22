import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium font-display text-ink-900",
        nav: "flex items-center justify-between absolute inset-x-0 top-0",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-7 w-7 p-0 opacity-70 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-7 w-7 p-0 opacity-70 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-ink-500 rounded-md w-9 font-normal text-xs",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal tabular aria-selected:opacity-100 rounded-card",
        ),
        selected: "[&>button]:bg-primary-500 [&>button]:text-white [&>button]:hover:bg-primary-600",
        today: "[&>button]:border [&>button]:border-primary-500 [&>button]:text-primary-600",
        outside: "text-ink-300 opacity-50",
        disabled: "text-ink-300 opacity-40",
        range_middle: "aria-selected:bg-primary-100 aria-selected:text-ink-900",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ),
      }}
      {...props}
    />
  );
}
