import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("rounded-card bg-ink-100 animate-pulse", className)}
      {...props}
    />
  );
}
