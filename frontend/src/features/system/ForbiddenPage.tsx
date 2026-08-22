import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldOff className="text-danger h-10 w-10" aria-hidden="true" />
      <div>
        <h1 className="font-display text-ink-900 text-2xl font-semibold">
          You don&apos;t have access to this
        </h1>
        <p className="text-ink-500 mt-1 text-sm">Ask your admin if you think this is a mistake.</p>
      </div>
      <Button asChild variant="secondary">
        <Link to="/employees">Back to Employees</Link>
      </Button>
    </div>
  );
}
