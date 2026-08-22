import { Construction } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

/**
 * Route-stub placeholder for a screen whose owning module hasn't landed yet
 * (see docs/Dayflow-Team-Plan.md §2.3 — M3/M4 overwrite these files directly,
 * they never touch the router). Keeps every declared route resolving to
 * something instead of 404ing.
 */
export function ComingSoon({ title, owner }: { title: string; owner: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="This screen is being built"
        description={`${owner} owns this module and hasn't shipped it to main yet.`}
      />
    </div>
  );
}
