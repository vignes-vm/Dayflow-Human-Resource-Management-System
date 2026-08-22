import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, ListChecks, Waves } from "lucide-react";
import type { AttendanceDayRow, AttendanceRecordDto, AttendanceSummary } from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DayRibbon } from "@/components/DayRibbon";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  PRESENT: "success",
  HALF_DAY: "warning",
  ON_LEAVE: "primary",
  ABSENT: "danger",
  HOLIDAY: "neutral",
  WEEKEND: "neutral",
};

function formatTime(d: string | Date | null) {
  return d ? format(new Date(d), "HH:mm") : "—";
}

function formatHours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function AttendancePage() {
  const { me } = useAuth();
  const isPrivileged = me?.user.role === "ADMIN" || me?.user.role === "HR";
  const [view, setView] = useState<"me" | "team">(isPrivileged ? "team" : "me");

  return (
    <div>
      <PageHeader
        title="Attendance"
        actions={
          isPrivileged ? (
            <div className="bg-ink-100 rounded-card inline-flex gap-1 p-1">
              <Button
                variant={view === "team" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setView("team")}
              >
                Team
              </Button>
              <Button
                variant={view === "me" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setView("me")}
              >
                My attendance
              </Button>
            </div>
          ) : undefined
        }
      />
      {view === "team" && isPrivileged ? <TeamAttendance /> : <MyAttendance />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// S10 — My attendance
// ---------------------------------------------------------------------------

function MyAttendance() {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [ribbonView, setRibbonView] = useState<"table" | "ribbon">("table");

  const summaryQuery = useQuery({
    queryKey: ["attendance", "summary", month],
    queryFn: () => api.get<AttendanceSummary>(`/attendance/summary?month=${month}`),
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance", "me", month],
    queryFn: () => api.get<{ data: AttendanceRecordDto[] }>(`/attendance/me?month=${month}`),
  });

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    setMonth(format(next, "yyyy-MM"));
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Days present" value={String(summaryQuery.data?.daysPresent ?? "—")} />
        <StatCard label="Leaves" value={String(summaryQuery.data?.leavesCount ?? "—")} />
        <StatCard
          label="Total working days"
          value={String(summaryQuery.data?.totalWorkingDays ?? "—")}
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">{format(new Date(`${month}-01`), "MMMM yyyy")}</span>
          <Button variant="secondary" size="icon" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="bg-ink-100 rounded-card inline-flex gap-1 p-1">
          <Button
            variant={ribbonView === "table" ? "primary" : "ghost"}
            size="icon"
            onClick={() => setRibbonView("table")}
            aria-label="Table view"
          >
            <ListChecks className="h-4 w-4" />
          </Button>
          <Button
            variant={ribbonView === "ribbon" ? "primary" : "ghost"}
            size="icon"
            onClick={() => setRibbonView("ribbon")}
            aria-label="Ribbon view"
          >
            <Waves className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {ribbonView === "table" ? (
        <DataTable<AttendanceRecordDto>
          columns={
            [
              { id: "date", header: "Date", cell: (r) => format(new Date(r.date), "dd MMM") },
              { id: "checkIn", header: "Check In", cell: (r) => formatTime(r.firstCheckIn) },
              { id: "checkOut", header: "Check Out", cell: (r) => formatTime(r.lastCheckOut) },
              {
                id: "workHours",
                header: "Work Hours",
                numeric: true,
                cell: (r) => formatHours(r.workMinutes),
              },
              {
                id: "extraHours",
                header: "Extra Hours",
                numeric: true,
                cell: (r) => formatHours(r.extraMinutes),
              },
              {
                id: "status",
                header: "Status",
                cell: (r) => (
                  <StatusPill label={r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
                ),
              },
            ] satisfies DataTableColumn<AttendanceRecordDto>[]
          }
          data={recordsQuery.data?.data ?? []}
          getRowId={(r) => r.id}
          loading={recordsQuery.isLoading}
          emptyTitle="No attendance recorded this month"
        />
      ) : (
        <div className="space-y-2">
          {(recordsQuery.data?.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="text-ink-500 w-16 shrink-0 text-xs">
                {format(new Date(r.date), "dd MMM")}
              </span>
              <DayRibbon date={r.date} status={r.status} sessions={r.sessions} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// S11 — Admin/HR team day view
// ---------------------------------------------------------------------------

function TeamAttendance() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<AttendanceDayRow | null>(null);

  const dayQuery = useQuery({
    queryKey: ["attendance", "day", date],
    queryFn: () => api.get<{ data: AttendanceDayRow[] }>(`/attendance/day?date=${date}`),
  });

  const shiftDay = (delta: number) => {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + delta);
    setDate(format(next, "yyyy-MM-dd"));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => shiftDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {format(new Date(`${date}T00:00:00`), "EEEE, dd MMM yyyy")}
          </span>
          <Button variant="secondary" size="icon" onClick={() => shiftDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
      </div>

      <DataTable<AttendanceDayRow>
        columns={
          [
            {
              id: "emp",
              header: "Emp",
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.employeeName}</p>
                  <p className="text-ink-400 tabular font-mono text-xs">{r.loginId}</p>
                </div>
              ),
            },
            { id: "checkIn", header: "Check In", cell: (r) => formatTime(r.firstCheckIn) },
            { id: "checkOut", header: "Check Out", cell: (r) => formatTime(r.lastCheckOut) },
            {
              id: "workHours",
              header: "Work Hours",
              numeric: true,
              cell: (r) => formatHours(r.workMinutes),
            },
            {
              id: "extraHours",
              header: "Extra Hours",
              numeric: true,
              cell: (r) => formatHours(r.extraMinutes),
            },
            {
              id: "status",
              header: "Status",
              cell: (r) => (
                <StatusPill label={r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
              ),
            },
          ] satisfies DataTableColumn<AttendanceDayRow>[]
        }
        data={dayQuery.data?.data ?? []}
        getRowId={(r) => r.employeeId}
        loading={dayQuery.isLoading}
        onRowClick={(r) => r.recordId && setSelected(r)}
        emptyTitle="No employees found"
      />

      <RegularizationDrawer row={selected} date={date} onClose={() => setSelected(null)} />
    </div>
  );
}

function RegularizationDrawer({
  row,
  date,
  onClose,
}: {
  row: AttendanceDayRow | null;
  date: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firstCheckIn, setFirstCheckIn] = useState("");
  const [lastCheckOut, setLastCheckOut] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/attendance/${row!.recordId}`, {
        firstCheckIn: firstCheckIn ? new Date(`${date}T${firstCheckIn}:00.000Z`) : undefined,
        lastCheckOut: lastCheckOut ? new Date(`${date}T${lastCheckOut}:00.000Z`) : undefined,
        status: status || undefined,
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", "day"] });
      toast({ variant: "success", title: "Attendance updated" });
      onClose();
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not update",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Regularise attendance</SheetTitle>
        </SheetHeader>
        {row ? (
          <div className="flex flex-1 flex-col gap-4">
            <p className="text-ink-500 text-sm">{row.employeeName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstCheckIn">Check in</Label>
                <Input
                  id="firstCheckIn"
                  type="time"
                  value={firstCheckIn}
                  onChange={(e) => setFirstCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastCheckOut">Check out</Label>
                <Input
                  id="lastCheckOut"
                  type="time"
                  value={lastCheckOut}
                  onChange={(e) => setLastCheckOut(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Input
                id="status"
                placeholder="PRESENT / ABSENT / HALF_DAY / ON_LEAVE"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <SheetFooter>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!reason.trim() || mutation.isPending}
              >
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
