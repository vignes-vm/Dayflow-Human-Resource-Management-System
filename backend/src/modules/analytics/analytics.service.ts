import type { AnalyticsOverviewQuery, AnalyticsOverviewResponse } from "@dayflow/shared";

import { prisma } from "@/lib/prisma.js";

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getOverview(
  companyId: string,
  query: AnalyticsOverviewQuery,
): Promise<AnalyticsOverviewResponse> {
  const to = query.to ?? new Date();
  const from = query.from ?? new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const spanMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - spanMs);
  const prevTo = new Date(from.getTime());

  const employeeWhere = {
    companyId,
    status: "ACTIVE" as const,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
  };
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, departmentId: true, department: { select: { name: true } } },
  });
  const employeeIds = employees.map((e) => e.id);

  const [records, prevRecords, requests, payslips] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { companyId, employeeId: { in: employeeIds }, date: { gte: from, lte: to } },
    }),
    prisma.attendanceRecord.findMany({
      where: { companyId, employeeId: { in: employeeIds }, date: { gte: prevFrom, lt: prevTo } },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lte: to },
        endDate: { gte: from },
      },
      include: { type: true },
    }),
    prisma.payslip.findMany({
      where: { companyId, status: "PUBLISHED" },
      select: { month: true, year: true, netPay: true, createdAt: true },
    }),
  ]);

  // Attendance rate by day
  const byDate = new Map<string, { present: number; total: number }>();
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { present: 0, total: 0 };
    if (r.status !== "WEEKEND" && r.status !== "HOLIDAY") {
      bucket.total += 1;
      if (r.status === "PRESENT" || r.status === "HALF_DAY") bucket.present += 1;
    }
    byDate.set(key, bucket);
  }
  const attendanceRateByDay = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({ date, rate: b.total ? Math.round((b.present / b.total) * 100) : 0 }));

  const rateOf = (recs: typeof records) => {
    const eligible = recs.filter((r) => r.status !== "WEEKEND" && r.status !== "HOLIDAY");
    if (eligible.length === 0) return 0;
    const present = eligible.filter(
      (r) => r.status === "PRESENT" || r.status === "HALF_DAY",
    ).length;
    return (present / eligible.length) * 100;
  };
  const attendanceRate = rateOf(records);
  const prevAttendanceRate = rateOf(prevRecords);

  // Time off by type
  const timeOffMap = new Map<string, number>();
  for (const r of requests) {
    timeOffMap.set(r.type.name, (timeOffMap.get(r.type.name) ?? 0) + r.days.toNumber());
  }
  const timeOffByType = Array.from(timeOffMap.entries()).map(([type, days]) => ({ type, days }));
  const totalTimeOffDays = requests.reduce((sum, r) => sum + r.days.toNumber(), 0);

  // Headcount by department
  const deptMap = new Map<string, number>();
  for (const e of employees) {
    const name = e.department?.name ?? "Unassigned";
    deptMap.set(name, (deptMap.get(name) ?? 0) + 1);
  }
  const headcountByDepartment = Array.from(deptMap.entries()).map(([department, count]) => ({
    department,
    count,
  }));

  // Payroll cost by month (last 6 published months)
  const monthMap = new Map<string, number>();
  for (const p of payslips) {
    const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + p.netPay.toNumber());
  }
  const payrollCostByMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, cost]) => ({ month, cost: Math.round(cost) }));
  const totalPayrollCost = payrollCostByMonth.reduce((sum, m) => sum + m.cost, 0);

  // Average check-in time by day
  const checkInByDate = new Map<string, number[]>();
  for (const r of records) {
    if (!r.firstCheckIn) continue;
    const key = r.date.toISOString().slice(0, 10);
    const minutes = r.firstCheckIn.getUTCHours() * 60 + r.firstCheckIn.getUTCMinutes();
    checkInByDate.set(key, [...(checkInByDate.get(key) ?? []), minutes]);
  }
  const averageCheckInTimeByDay = Array.from(checkInByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mins]) => ({
      date,
      minutesAfterMidnight: Math.round(mins.reduce((s, m) => s + m, 0) / mins.length),
    }));

  // Stats
  const totalMinutes = records.reduce((sum, r) => sum + r.workMinutes, 0);
  const prevTotalMinutes = prevRecords.reduce((sum, r) => sum + r.workMinutes, 0);
  const avgWorkHours = records.length ? totalMinutes / 60 / records.length : 0;
  const prevAvgWorkHours = prevRecords.length ? prevTotalMinutes / 60 / prevRecords.length : 0;

  const totalExtraMinutes = records.reduce((sum, r) => sum + r.extraMinutes, 0);
  const prevTotalExtraMinutes = prevRecords.reduce((sum, r) => sum + r.extraMinutes, 0);

  return {
    stats: {
      attendanceRate: {
        value: Math.round(attendanceRate),
        deltaPercent: pctDelta(attendanceRate, prevAttendanceRate),
      },
      averageWorkHours: {
        value: Math.round(avgWorkHours * 10) / 10,
        deltaPercent: pctDelta(avgWorkHours, prevAvgWorkHours),
      },
      totalExtraHours: {
        value: Math.round((totalExtraMinutes / 60) * 10) / 10,
        deltaPercent: pctDelta(totalExtraMinutes, prevTotalExtraMinutes),
      },
      totalTimeOffDays: { value: Math.round(totalTimeOffDays), deltaPercent: null },
      totalPayrollCost: { value: totalPayrollCost, deltaPercent: null },
    },
    attendanceRateByDay,
    timeOffByType,
    headcountByDepartment,
    payrollCostByMonth,
    averageCheckInTimeByDay,
  };
}
