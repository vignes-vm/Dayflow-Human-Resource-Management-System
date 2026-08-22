import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Systray check-in/out control, stubbed per Dayflow-ClaudeCode-Prompts-v2.md
 * Step 6 — "Wire it to stubs for now — Step 10 supplies the API." M4 replaces
 * this component's internals once /attendance/check-in exists; the shell
 * position and props stay the same.
 */
export function CheckInControl() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button variant="secondary" size="sm" disabled className="gap-1.5">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Check In
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Attendance isn&apos;t live yet — coming in a later build.</TooltipContent>
    </Tooltip>
  );
}
