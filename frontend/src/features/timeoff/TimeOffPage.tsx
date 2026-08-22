import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { TimeOffBalance, TimeOffImpactResponse, TimeOffRequestDto } from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YearCalendar, type YearCalendarDay } from "@/components/YearCalendar";
import { CoverageRadar } from "@/components/CoverageRadar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";
import { RequestModal } from "@/features/timeoff/RequestModal";
import { AllocationTab } from "@/features/timeoff/AllocationTab";

export default function TimeOffPage() {
  const { me } = useAuth();
  const isPrivileged = me?.user.role === "ADMIN" || me?.user.role === "HR";

  return (
    <div>
      <PageHeader title="Time Off" />
      {isPrivileged ? (
        <Tabs defaultValue="time-off">
          <TabsList>
            <TabsTrigger value="time-off">Time Off</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
          </TabsList>
          <TabsContent value="time-off">
            <AdminTimeOff />
          </TabsContent>
          <TabsContent value="allocation">
            <AllocationTab />
          </TabsContent>
        </Tabs>
      ) : (
        <EmployeeTimeOff />
      )}
    </div>
  );
}

function BalanceHeaders() {
  const query = useQuery({
    queryKey: ["time-off", "balances"],
    queryFn: () => api.get<{ data: TimeOffBalance[] }>("/time-off/balances"),
  });

  if (query.isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {(query.data?.data ?? [])
        .filter((b) => b.code !== "UNPAID")
        .map((b) => (
          <StatCard
            key={b.typeId}
            label={`${b.typeName} — ${b.remaining} Days Available`}
            value={b.remaining}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee — S14/S15
// ---------------------------------------------------------------------------

function EmployeeTimeOff() {
  const [modalOpen, setModalOpen] = useState(false);
  const year = new Date().getFullYear();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calendarQuery = useQuery({
    queryKey: ["time-off", "calendar", year],
    queryFn: () => api.get<{ data: YearCalendarDay[] }>(`/time-off/requests/calendar?year=${year}`),
  });
  const requestsQuery = useQuery({
    queryKey: ["time-off", "requests", "mine"],
    queryFn: () => api.get<{ data: TimeOffRequestDto[] }>("/time-off/requests"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/time-off/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      toast({ variant: "success", title: "Request cancelled" });
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not cancel",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New
        </Button>
      </div>

      <BalanceHeaders />

      {calendarQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <YearCalendar year={year} days={calendarQuery.data?.data ?? []} />
      )}

      <div className="mt-8">
        <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
          My requests
        </p>
        {requestsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !requestsQuery.data?.data.length ? (
          <EmptyState title="No requests yet" />
        ) : (
          <div className="divide-border rounded-card border-border divide-y border">
            {requestsQuery.data.data.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {r.typeName} · {format(new Date(r.startDate), "dd MMM")} –{" "}
                    {format(new Date(r.endDate), "dd MMM yyyy")}
                  </p>
                  {r.decisionComment ? (
                    <p className="text-ink-500 text-xs">{r.decisionComment}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      r.status === "APPROVED"
                        ? "success"
                        : r.status === "REFUSED"
                          ? "danger"
                          : r.status === "CANCELLED"
                            ? "neutral"
                            : "primary"
                    }
                  >
                    {r.status}
                  </Badge>
                  {r.status === "TO_APPROVE" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelMutation.mutate(r.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RequestModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin/HR — S12
// ---------------------------------------------------------------------------

function AdminTimeOff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [statusFilter, setStatusFilter] = useState("TO_APPROVE");

  const requestsQuery = useQuery({
    queryKey: ["time-off", "requests", statusFilter],
    queryFn: () =>
      api.get<{ data: TimeOffRequestDto[] }>(
        `/time-off/requests${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
  });

  const impactQuery = useQuery({
    queryKey: ["time-off", "impact", expanded],
    queryFn: () => api.get<TimeOffImpactResponse>(`/time-off/${expanded}/impact`),
    enabled: !!expanded,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVED" | "REFUSED" }) =>
      api.post(`/time-off/${id}/decide`, { decision, comment: comment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      setExpanded(null);
      setComment("");
      toast({ variant: "success", title: "Decision recorded" });
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not record decision",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  if (requestsQuery.isError) return <ErrorState onRetry={() => requestsQuery.refetch()} />;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {["TO_APPROVE", "APPROVED", "REFUSED", ""].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !requestsQuery.data?.data.length ? (
        <EmptyState title="No pending requests. You're all caught up." />
      ) : (
        <div className="space-y-2">
          {requestsQuery.data.data.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="rounded-card border-border bg-surface border">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="focus-visible:ring-focusRing flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="w-40 shrink-0 font-medium">{r.employeeName}</span>
                  <span className="text-ink-500 w-28 shrink-0 text-sm">
                    {format(new Date(r.startDate), "dd MMM")}
                  </span>
                  <span className="text-ink-500 w-28 shrink-0 text-sm">
                    {format(new Date(r.endDate), "dd MMM")}
                  </span>
                  <span className="text-ink-500 w-32 shrink-0 text-sm">{r.typeName}</span>
                  <Badge variant="primary" className="mr-auto">
                    {r.status}
                  </Badge>
                  {r.status === "TO_APPROVE" ? (
                    <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => decideMutation.mutate({ id: r.id, decision: "REFUSED" })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => decideMutation.mutate({ id: r.id, decision: "APPROVED" })}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : null}
                </button>
                {isOpen ? (
                  <div className="border-border space-y-3 border-t px-4 py-3">
                    {impactQuery.isLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : impactQuery.data ? (
                      <CoverageRadar impact={impactQuery.data} />
                    ) : null}
                    <Input
                      placeholder="Decision comment (required to reject)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
