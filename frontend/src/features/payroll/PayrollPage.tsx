import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import type { PayslipDraftRow, PayslipSummary } from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError, API_ORIGIN } from "@/lib/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMoney(amount: string) {
  const n = Number(amount);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
}

export default function PayrollPage() {
  const { me } = useAuth();
  const isAdmin = me?.user.role === "ADMIN";

  return isAdmin ? <PayrollConsole /> : <MyPayslips />;
}

function PayrollConsole() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [drafts, setDrafts] = useState<PayslipDraftRow[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runMutation = useMutation({
    mutationFn: () => api.post<{ drafts: PayslipDraftRow[] }>("/payroll/run", { month, year }),
    onSuccess: (res) => setDrafts(res.drafts),
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not run payroll",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post<{ count: number }>("/payroll/publish", { month, year }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast({ variant: "success", title: `Published ${res.count} payslip(s)` });
      runMutation.mutate();
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not publish",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const hasAnomalies = drafts?.some((d) => d.anomalies.length > 0) ?? false;

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Attendance-driven payroll — run a month, review, then publish."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          {runMutation.isPending ? "Running…" : "Run payroll"}
        </Button>
        {drafts ? (
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={publishMutation.isPending}
          >
            Publish
          </Button>
        ) : null}
      </div>

      {runMutation.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : drafts && drafts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-500 border-border border-b text-left text-xs uppercase">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4 text-right">Working days</th>
                <th className="py-2 pr-4 text-right">Payable</th>
                <th className="py-2 pr-4 text-right">LOP</th>
                <th className="py-2 pr-4 text-right">Gross</th>
                <th className="py-2 pr-4 text-right">Net</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {drafts.map((d) => (
                <tr key={d.employeeId} className={d.anomalies.length ? "bg-danger-100/40" : ""}>
                  <td className="py-2 pr-4">
                    <p className="font-medium">{d.employeeName}</p>
                    <p className="text-ink-400 tabular font-mono text-xs">{d.loginId}</p>
                    {d.anomalies.map((a) => (
                      <p key={a.type} className="text-danger text-xs">
                        {a.message}
                      </p>
                    ))}
                  </td>
                  <td className="tabular py-2 pr-4 text-right font-mono">{d.totalWorkingDays}</td>
                  <td className="tabular py-2 pr-4 text-right font-mono">{d.payableDays}</td>
                  <td className="tabular py-2 pr-4 text-right font-mono">
                    ₹{formatMoney(d.lossOfPay)}
                  </td>
                  <td className="tabular py-2 pr-4 text-right font-mono">
                    ₹{formatMoney(d.grossEarnings)}
                  </td>
                  <td className="tabular py-2 pr-4 text-right font-mono font-semibold">
                    ₹{formatMoney(d.netPay)}
                  </td>
                  <td className="py-2 pr-4">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : drafts ? (
        <EmptyState title="No active employees" description="Nothing to run payroll for." />
      ) : (
        <EmptyState
          title="Nothing run yet"
          description="Pick a month and run payroll to see the draft table."
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish {drafts?.length ?? 0} payslip(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-ink-500 text-sm">
            This generates PDFs and emails every employee their payslip for {MONTHS[month - 1]}{" "}
            {year}. Published payslips are frozen and can't be regenerated from live data.
            {hasAnomalies ? " Some rows have unresolved anomalies." : ""}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyPayslips() {
  const { me } = useAuth();
  const employeeId = me?.employee?.id ?? "";

  const query = useQuery({
    queryKey: ["payslips", employeeId],
    queryFn: () => api.get<{ data: PayslipSummary[] }>(`/payroll/payslips/${employeeId}`),
    enabled: !!employeeId,
  });

  const byYear = new Map<number, PayslipSummary[]>();
  for (const p of query.data?.data ?? []) {
    if (!byYear.has(p.year)) byYear.set(p.year, []);
    byYear.get(p.year)!.push(p);
  }

  return (
    <div>
      <PageHeader title="My payslips" />
      <div className="bg-ink-100 text-ink-700 rounded-card mb-6 px-4 py-2 text-sm">
        Your salary is managed by HR.
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : byYear.size === 0 ? (
        <EmptyState
          title="No payslips yet"
          description="Once payroll is run and published, they'll show up here."
        />
      ) : (
        Array.from(byYear.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, payslips]) => (
            <div key={year} className="mb-6">
              <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">
                {year}
              </p>
              <div className="divide-border rounded-card border-border divide-y border">
                {payslips.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{format(new Date(p.year, p.month - 1, 1), "MMMM")}</span>
                    <span className="tabular font-mono font-semibold">
                      ₹{formatMoney(p.netPay)}
                    </span>
                    {p.pdfUrl ? (
                      <a
                        href={`${API_ORIGIN}${p.pdfUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-500 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download PDF
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
