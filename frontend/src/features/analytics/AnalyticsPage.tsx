import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsOverviewResponse } from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const CHART_COLORS = ["#4c46e5", "#0e9f8e", "#e08a2e", "#7c5cd6", "#d8434a"];

export default function AnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const query = useQuery({
    queryKey: ["analytics", "overview", from, to],
    queryFn: () => api.get<AnalyticsOverviewResponse>(`/analytics/overview?${params.toString()}`),
  });

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="What attendance, time off and payroll are telling leadership."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !query.data ? (
        <EmptyState title="No data for this range" />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Attendance rate" value={`${query.data.stats.attendanceRate.value}%`} />
            <StatCard label="Avg work hours" value={query.data.stats.averageWorkHours.value} />
            <StatCard label="Total extra hours" value={query.data.stats.totalExtraHours.value} />
            <StatCard label="Total time off days" value={query.data.stats.totalTimeOffDays.value} />
            <StatCard
              label="Payroll cost"
              value={`₹${query.data.stats.totalPayrollCost.value.toLocaleString("en-IN")}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Attendance rate">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={query.data.attendanceRateByDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#4c46e5"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Time off by type">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={query.data.timeOffByType}
                    dataKey="days"
                    nameKey="type"
                    outerRadius={90}
                  >
                    {query.data.timeOffByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Headcount by department">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={query.data.headcountByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0e9f8e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Payroll cost by month">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={query.data.payrollCostByMonth}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cost" fill="#7c5cd6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Average check-in time">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={query.data.averageCheckInTimeByDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
                    }
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="minutesAfterMidnight"
                    stroke="#e08a2e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border-border bg-surface border p-4">
      <p className="font-display text-ink-900 mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}
