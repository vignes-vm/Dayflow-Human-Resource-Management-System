import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PresenceDot } from "@/components/PresenceDot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";

interface MyTodayResponse {
  hasOpenSession: boolean;
  presence: "GREEN" | "AIRPLANE" | "YELLOW" | "RED";
  onApprovedLeave: boolean;
  checkedInAt: string | null;
}

function formatElapsed(since: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** Systray check-in/out control — see AppShell.tsx and Dayflow-Blueprint-v2.md §10.3. */
export function CheckInControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());

  const query = useQuery({
    queryKey: ["attendance", "me", "today"],
    queryFn: () => api.get<MyTodayResponse>("/attendance/me/today"),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!query.data?.hasOpenSession) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [query.data?.hasOpenSession]);

  const checkInMutation = useMutation({
    mutationFn: () => api.post("/attendance/check-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ variant: "success", title: "Checked in" });
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not check in",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post("/attendance/check-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ variant: "success", title: "Checked out" });
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not check out",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const disabled = query.isLoading || checkInMutation.isPending || checkOutMutation.isPending;
  const onLeave = query.data?.onApprovedLeave ?? false;
  const hasOpenSession = query.data?.hasOpenSession ?? false;

  const button = hasOpenSession ? (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      disabled={disabled}
      onClick={() => checkOutMutation.mutate()}
    >
      <PresenceDot state="GREEN" />
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      Check Out
      {query.data?.checkedInAt ? (
        <span className="tabular text-ink-400 ml-1 font-mono text-xs">
          {formatElapsed(new Date(query.data.checkedInAt), now)}
        </span>
      ) : null}
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      disabled={disabled || onLeave}
      onClick={() => checkInMutation.mutate()}
    >
      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
      Check In
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{button}</span>
      </TooltipTrigger>
      <TooltipContent>
        {onLeave ? "You're on approved leave today" : hasOpenSession ? "Check out" : "Check in"}
      </TooltipContent>
    </Tooltip>
  );
}
