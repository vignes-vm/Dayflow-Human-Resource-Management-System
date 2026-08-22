import { Link } from "react-router-dom";
import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <CompassIcon className="text-ink-400 h-10 w-10" aria-hidden="true" />
      <div>
        <h1 className="font-display text-ink-900 text-2xl font-semibold">Page not found</h1>
        <p className="text-ink-500 mt-1 text-sm">The page you're looking for doesn't exist.</p>
      </div>
      <Button asChild>
        <Link to="/employees">Back to Employees</Link>
      </Button>
    </div>
  );
}
