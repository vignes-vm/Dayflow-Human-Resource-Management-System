import { PresenceDot } from "@/components/PresenceDot";
import type { PresenceState } from "@dayflow/shared";

export const title = "PresenceDot";

const STATES: PresenceState[] = ["GREEN", "AIRPLANE", "YELLOW", "RED"];

export default function PresenceDotDemo() {
  return (
    <div className="flex flex-wrap gap-6">
      {STATES.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <span className="bg-ink-200 flex h-10 w-10 items-center justify-center rounded-full">
            <PresenceDot state={s} />
          </span>
          <span className="text-ink-700 text-sm">{s}</span>
        </div>
      ))}
    </div>
  );
}
