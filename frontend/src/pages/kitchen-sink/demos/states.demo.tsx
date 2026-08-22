import { Users } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

export const title = "Empty / Error / Skeleton states";

export default function StatesDemo() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <EmptyState
        icon={Users}
        title="No employees yet"
        description="Add your first employee to get started."
        action={{ label: "New employee", onClick: () => {} }}
      />
      <ErrorState onRetry={() => {}} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
