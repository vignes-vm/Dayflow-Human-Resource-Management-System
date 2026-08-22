import { Skeleton } from "@/components/ui/skeleton";

/** Shown while auth/session state resolves — never flash the sign-in screen. */
export function ShellSkeleton() {
  return (
    <div className="bg-paper min-h-screen">
      <div className="border-border bg-surface flex h-16 items-center justify-between border-b px-6">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="p-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
