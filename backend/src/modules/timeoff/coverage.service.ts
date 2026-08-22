import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma.js";
import { computeWorkingDays } from "@/engines/workingDays.js";
import { computeCoveragePercent, computeCoverageLevel } from "@/engines/coverage.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type { TimeOffFlag, TimeOffImpactResponse } from "@dayflow/shared";

function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

/** The Coverage Radar — see Dayflow-Blueprint-v2.md §3.1 and §14. */
export async function computeImpact(
  requestId: string,
  companyId: string,
): Promise<TimeOffImpactResponse> {
  const request = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, companyId },
    include: {
      employee: { select: { id: true, departmentId: true, managerId: true } },
      type: true,
    },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Request not found");

  const [company, holidays] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.holiday.findMany({
      where: { companyId, date: { gte: request.startDate, lte: request.endDate } },
    }),
  ]);

  const workingDaysResult = computeWorkingDays({
    startDate: request.startDate,
    endDate: request.endDate,
    workDaysPerWeek: company.workDaysPerWeek,
    holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
    halfDay: request.halfDay,
  });
  const workingDays = "days" in workingDaysResult ? workingDaysResult.days : 0;
  const excludedDates = workingDaysResult.excludedDates;

  // Allocation after
  const [allocations, approvedRequests] = await Promise.all([
    prisma.timeOffAllocation.findMany({
      where: {
        companyId,
        employeeId: request.employeeId,
        typeId: request.typeId,
        status: "APPROVED",
      },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        companyId,
        employeeId: request.employeeId,
        typeId: request.typeId,
        status: "APPROVED",
      },
    }),
  ]);
  const allocated = allocations.reduce((sum, a) => sum.plus(a.days), new Decimal(0));
  const used = approvedRequests.reduce((sum, r) => sum.plus(r.days), new Decimal(0));
  const thisRequest = request.days;
  const remaining = allocated.minus(used).minus(thisRequest);

  const allocationAfter = request.type.isPaid
    ? {
        type: request.type.name,
        allocated: allocated.toFixed(1),
        used: used.toFixed(1),
        thisRequest: thisRequest.toFixed(1),
        remaining: remaining.toFixed(1),
      }
    : null;

  // Team = same department, or (if no department) same manager.
  const teamWhere = request.employee.departmentId
    ? { companyId, departmentId: request.employee.departmentId, status: "ACTIVE" as const }
    : request.employee.managerId
      ? { companyId, managerId: request.employee.managerId, status: "ACTIVE" as const }
      : { companyId, id: request.employeeId, status: "ACTIVE" as const };

  const team = await prisma.employee.findMany({
    where: teamWhere,
    select: { id: true, firstName: true, lastName: true, jobTitle: true },
  });
  const teamIds = team.map((t) => t.id);
  const headcount = team.length;

  // Overlapping approved/pending leave across the team for the request range.
  const teamLeaves = await prisma.timeOffRequest.findMany({
    where: {
      companyId,
      employeeId: { in: teamIds },
      status: { in: ["APPROVED", "TO_APPROVE"] },
      startDate: { lte: request.endDate },
      endDate: { gte: request.startDate },
    },
    include: { employee: { select: { firstName: true, lastName: true, jobTitle: true } } },
  });

  const teamCoverage = [];
  for (let d = new Date(request.startDate); d <= request.endDate; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow > company.workDaysPerWeek) continue; // skip non-working days
    const away = teamLeaves.filter((l) => d >= l.startDate && d <= l.endDate).length + 1; // +1 for this request itself
    const coverage = computeCoveragePercent(headcount, away);
    const level = computeCoverageLevel(
      coverage,
      company.coverageOkThreshold,
      company.coverageRiskThreshold,
    );
    teamCoverage.push({
      date: d.toISOString().slice(0, 10),
      headcount,
      away,
      coverage,
      level,
    });
  }

  const collisions = teamLeaves
    .filter((l) => l.employeeId !== request.employeeId)
    .map((l) => ({
      employeeId: l.employeeId,
      employee: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
      designation: l.employee.jobTitle,
      dates: `${l.startDate.toISOString().slice(0, 10)}–${l.endDate.toISOString().slice(0, 10)}`,
      status: l.status,
    }));

  // Flags
  const flags: TimeOffFlag[] = [];
  const thisMonthRequests = await prisma.timeOffRequest.count({
    where: {
      companyId,
      employeeId: request.employeeId,
      id: { not: request.id },
      createdAt: {
        gte: new Date(
          Date.UTC(request.createdAt.getUTCFullYear(), request.createdAt.getUTCMonth(), 1),
        ),
      },
    },
  });
  if (thisMonthRequests > 0) flags.push("SECOND_REQUEST_THIS_MONTH");
  if (request.startDate.getUTCMonth() !== request.endDate.getUTCMonth()) {
    flags.push("CROSSES_MONTH_END");
  }
  const noticeDays = Math.floor(
    (request.startDate.getTime() - request.createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (noticeDays < 2) flags.push("SHORT_NOTICE");
  if (request.type.requiresAttachment && !request.attachmentUrl) {
    flags.push("NO_CERTIFICATE_ATTACHED");
  }
  const adjacentToHoliday = holidays.some((h) => {
    const dayBefore = addDays(request.startDate, -1).getTime();
    const dayAfter = addDays(request.endDate, 1).getTime();
    return h.date.getTime() === dayBefore || h.date.getTime() === dayAfter;
  });
  if (adjacentToHoliday) flags.push("ADJACENT_TO_HOLIDAY");

  return {
    allocationAfter,
    workingDays,
    excludedDates,
    teamCoverage,
    collisions,
    flags,
  };
}
