import { Plane } from "lucide-react";

import { cn } from "@/lib/cn";
import type { PresenceState } from "@dayflow/shared";

const PRESENCE_META: Record<PresenceState, { label: string; className: string }> = {
  GREEN: { label: "Present", className: "bg-present" },
  AIRPLANE: { label: "On leave", className: "bg-leave" },
  YELLOW: { label: "Absent", className: "bg-half" },
  RED: { label: "Not checked in", className: "bg-absent" },
};

export interface PresenceDotProps {
  state: PresenceState;
  className?: string;
}

/**
 * Never colour alone: every dot carries a `title` and the leave state renders
 * an airplane glyph instead of a fourth colour. See Dayflow-Blueprint-v2.md §12.
 */
export function PresenceDot({ state, className }: PresenceDotProps) {
  const meta = PRESENCE_META[state];
  return (
    <span
      role="img"
      title={meta.label}
      aria-label={meta.label}
      className={cn(
        "ring-surface relative inline-flex h-[10px] w-[10px] items-center justify-center rounded-full ring-2",
        meta.className,
        className,
      )}
    >
      {state === "AIRPLANE" ? (
        <Plane
          className="h-[7px] w-[7px] -rotate-45 text-white"
          strokeWidth={3}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
