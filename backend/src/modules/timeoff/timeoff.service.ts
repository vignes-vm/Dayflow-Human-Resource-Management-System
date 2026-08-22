import { Decimal } from "decimal.js";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { notify } from "@/lib/notify.js";
import { computeWorkingDays } from "@/engines/workingDays.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type {
  CreateAllocationInput,
  CreateTimeOffRequestInput,
  CreateTimeOffTypeInput,
  DecideTimeOffRequestInput,
  TimeOffRequestPreviewInput,
  UpdateAllocationInput,
  UpdateTimeOffTypeInput,
} from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export async function listTypes(companyId: string) {
  const types = await prisma.timeOffType.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return types.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    isPaid: t.isPaid,
    requiresAttachment: t.requiresAttachment,
    colorToken: t.colorToken,
    defaultAllocationDays: t.defaultAllocationDays.toFixed(1),
  }));
}

export async function createType(
  companyId: string,
  actorId: string,
  input: CreateTimeOffTypeInput,
) {
  const type = await prisma.timeOffType.create({
    data: {
      companyId,
      name: input.name,
      code: input.code,
      isPaid: input.isPaid,
      requiresAttachment: input.requiresAttachment,
      colorToken: input.colorToken,
      defaultAllocationDays: input.defaultAllocationDays,
    },
  });
  await writeAudit({
    companyId,
    actorId,
    action: "TIME_OFF_TYPE_CREATED",
    entity: "TimeOffType",
    entityId: type.id,
    after: { name: type.name, code: type.code },
  });
  return type;
}

export async function updateType(
  id: string,
  companyId: string,
  actorId: string,
  input: UpdateTimeOffTypeInput,
) {
  const before = await prisma.timeOffType.findFirst({ where: { id, companyId } });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Time off type not found");

  const updated = await prisma.timeOffType.update({ where: { id }, data: input });
  await writeAudit({
    companyId,
    actorId,
    action: "TIME_OFF_TYPE_UPDATED",
    entity: "TimeOffType",
    entityId: id,
    before: { name: before.name },
    after: { name: updated.name },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

export async function listAllocations(companyId: string, employeeId?: string) {
  const allocations = await prisma.timeOffAllocation.findMany({
    where: { companyId, ...(employeeId ? { employeeId } : {}) },
    include: { employee: { select: { firstName: true, lastName: true } }, type: true },
    orderBy: { createdAt: "desc" },
  });

  // Used days per (employeeId, typeId) from approved requests.
  const usedByKey = await usedDaysByEmployeeAndType(companyId, employeeId);

  return allocations.map((a) => {
    const key = `${a.employeeId}:${a.typeId}`;
    const used = usedByKey.get(key) ?? new Decimal(0);
    return {
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
      typeId: a.typeId,
      typeName: a.type.name,
      days: a.days.toFixed(1),
      used: used.toFixed(1),
      remaining: a.days.minus(used).toFixed(1),
      validFrom: a.validFrom,
      validTo: a.validTo,
      status: a.status,
      note: a.note,
    };
  });
}

async function usedDaysByEmployeeAndType(companyId: string, employeeId?: string) {
  const approved = await prisma.timeOffRequest.findMany({
    where: { companyId, status: "APPROVED", ...(employeeId ? { employeeId } : {}) },
    select: { employeeId: true, typeId: true, days: true },
  });
  const map = new Map<string, Decimal>();
  for (const r of approved) {
    const key = `${r.employeeId}:${r.typeId}`;
    map.set(key, (map.get(key) ?? new Decimal(0)).plus(r.days));
  }
  return map;
}

export async function createAllocation(
  companyId: string,
  actorId: string,
  input: CreateAllocationInput,
) {
  const rows = input.employeeIds.map((employeeId) => ({
    companyId,
    employeeId,
    typeId: input.typeId,
    days: input.days,
    validFrom: input.validFrom,
    validTo: input.validTo,
    status: "APPROVED" as const,
    allocatedById: actorId,
    note: input.note,
  }));

  await prisma.timeOffAllocation.createMany({ data: rows });

  await writeAudit({
    companyId,
    actorId,
    action: "TIME_OFF_ALLOCATED",
    entity: "TimeOffAllocation",
    entityId: input.typeId,
    after: { employeeIds: input.employeeIds, days: input.days },
  });

  await notify({
    companyId,
    userIds: await employeeIdsToUserIds(input.employeeIds),
    type: "ALLOCATION_GRANTED",
    title: "Time off allocated",
    body: `You've been allocated ${input.days} day(s).`,
    link: "/time-off",
  });

  return { count: rows.length };
}

export async function updateAllocation(
  id: string,
  companyId: string,
  actorId: string,
  input: UpdateAllocationInput,
) {
  const before = await prisma.timeOffAllocation.findFirst({ where: { id, companyId } });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Allocation not found");

  const updated = await prisma.timeOffAllocation.update({ where: { id }, data: input });
  await writeAudit({
    companyId,
    actorId,
    action: "TIME_OFF_ALLOCATION_UPDATED",
    entity: "TimeOffAllocation",
    entityId: id,
    before: { days: before.days.toString() },
    after: { days: updated.days.toString() },
  });
  return updated;
}

async function employeeIdsToUserIds(employeeIds: string[]): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { userId: true },
  });
  return employees.map((e) => e.userId);
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export async function getBalances(companyId: string, employeeId: string) {
  const [types, allocations, requests] = await Promise.all([
    prisma.timeOffType.findMany({ where: { companyId } }),
    prisma.timeOffAllocation.findMany({
      where: { companyId, employeeId, status: "APPROVED" },
    }),
    prisma.timeOffRequest.findMany({
      where: { companyId, employeeId, status: { in: ["APPROVED", "TO_APPROVE"] } },
    }),
  ]);

  return types.map((type) => {
    const allocated = allocations
      .filter((a) => a.typeId === type.id)
      .reduce((sum, a) => sum.plus(a.days), new Decimal(0));
    const used = requests
      .filter((r) => r.typeId === type.id && r.status === "APPROVED")
      .reduce((sum, r) => sum.plus(r.days), new Decimal(0));
    const pending = requests
      .filter((r) => r.typeId === type.id && r.status === "TO_APPROVE")
      .reduce((sum, r) => sum.plus(r.days), new Decimal(0));
    const remaining = allocated.minus(used).minus(pending);

    return {
      typeId: type.id,
      typeName: type.name,
      code: type.code,
      colorToken: type.colorToken,
      allocated: allocated.toFixed(1),
      used: used.toFixed(1),
      pending: pending.toFixed(1),
      remaining: remaining.toFixed(1),
    };
  });
}

// ---------------------------------------------------------------------------
// Request preview / create
// ---------------------------------------------------------------------------

async function computePreview(
  companyId: string,
  employeeId: string,
  input: TimeOffRequestPreviewInput,
) {
  const [company, type, holidays] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.timeOffType.findFirst({ where: { id: input.typeId, companyId } }),
    prisma.holiday.findMany({
      where: { companyId, date: { gte: input.startDate, lte: input.endDate } },
    }),
  ]);

  if (!type) throw new ApiError(404, "NOT_FOUND", "Time off type not found");

  if (input.startDate < new Date(new Date().setUTCHours(0, 0, 0, 0))) {
    return { type, error: "PAST_DATE_NOT_ALLOWED" as const, workingDaysResult: null };
  }

  const workingDaysResult = computeWorkingDays({
    startDate: input.startDate,
    endDate: input.endDate,
    workDaysPerWeek: company.workDaysPerWeek,
    holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
    halfDay: input.halfDay,
  });

  if ("error" in workingDaysResult) {
    return { type, error: workingDaysResult.error, workingDaysResult };
  }

  if (type.requiresAttachment) {
    return { type, error: null, workingDaysResult, needsAttachment: true };
  }

  // Overlap check
  const overlapping = await prisma.timeOffRequest.findFirst({
    where: {
      companyId,
      employeeId,
      status: { in: ["TO_APPROVE", "APPROVED"] },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
    },
  });
  if (overlapping) {
    return { type, error: "OVERLAPPING_REQUEST" as const, workingDaysResult };
  }

  // Balance check (skip for unpaid types)
  if (type.isPaid) {
    const balances = await getBalances(companyId, employeeId);
    const balance = balances.find((b) => b.typeId === type.id);
    const remaining = new Decimal(balance?.remaining ?? "0");
    if (remaining.lessThan(workingDaysResult.days)) {
      return {
        type,
        error: "INSUFFICIENT_BALANCE" as const,
        workingDaysResult,
        remaining: remaining.toFixed(1),
      };
    }
    return { type, error: null, workingDaysResult, remaining: remaining.toFixed(1) };
  }

  return { type, error: null, workingDaysResult, remaining: null };
}

export async function previewRequest(
  companyId: string,
  employeeId: string,
  input: TimeOffRequestPreviewInput,
) {
  const result = await computePreview(companyId, employeeId, input);
  const workingDays =
    result.workingDaysResult && "days" in result.workingDaysResult
      ? result.workingDaysResult.days
      : 0;
  const excludedDates = result.workingDaysResult?.excludedDates ?? [];

  const warnings: string[] = [];
  if ("needsAttachment" in result && result.needsAttachment) {
    warnings.push("A certificate attachment is required for this type.");
  }

  const remaining = "remaining" in result ? (result.remaining ?? null) : null;
  const balanceAfter =
    remaining !== null ? new Decimal(remaining).minus(workingDays).toFixed(1) : null;

  return {
    workingDays,
    excludedDates,
    balanceRemaining: remaining,
    balanceAfter,
    warnings,
    error:
      result.error ??
      ("needsAttachment" in result && result.needsAttachment ? "ATTACHMENT_REQUIRED" : null),
  };
}

export async function createRequest(
  companyId: string,
  employeeId: string,
  input: CreateTimeOffRequestInput,
) {
  const preview = await computePreview(companyId, employeeId, {
    typeId: input.typeId,
    startDate: input.startDate,
    endDate: input.endDate,
    halfDay: input.halfDay,
  });

  if (preview.error) {
    throw new ApiError(400, preview.error, describeError(preview.error));
  }
  if ("needsAttachment" in preview && preview.needsAttachment && !input.attachmentUrl) {
    throw new ApiError(400, "ATTACHMENT_REQUIRED", "This time off type requires an attachment");
  }
  if (!preview.workingDaysResult || !("days" in preview.workingDaysResult)) {
    throw new ApiError(400, "ZERO_WORKING_DAYS", "This range has no working days");
  }

  const request = await prisma.timeOffRequest.create({
    data: {
      companyId,
      employeeId,
      typeId: input.typeId,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay,
      days: preview.workingDaysResult.days,
      reason: input.reason,
      attachmentUrl: input.attachmentUrl,
      status: "TO_APPROVE",
    },
  });

  await writeAudit({
    companyId,
    actorId: (await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })).userId,
    action: "TIME_OFF_REQUESTED",
    entity: "TimeOffRequest",
    entityId: request.id,
    after: { typeId: input.typeId, days: preview.workingDaysResult.days },
  });

  const admins = await prisma.user.findMany({
    where: { companyId, role: { in: ["ADMIN", "HR"] } },
    select: { id: true },
  });
  await notify({
    companyId,
    userIds: admins.map((a) => a.id),
    type: "TIME_OFF_SUBMITTED",
    title: "New time off request",
    body: `A new request needs your review.`,
    link: "/time-off",
  });

  return request;
}

function describeError(code: string): string {
  const messages: Record<string, string> = {
    PAST_DATE_NOT_ALLOWED: "You can't request time off in the past",
    ZERO_WORKING_DAYS: "This range has no working days to request",
    OVERLAPPING_REQUEST: "This overlaps an existing request",
    INSUFFICIENT_BALANCE: "You don't have enough balance remaining",
  };
  return messages[code] ?? code;
}

// ---------------------------------------------------------------------------
// List / decide / cancel
// ---------------------------------------------------------------------------

export async function listRequests(
  companyId: string,
  filters: { status?: string; employeeId?: string; from?: Date; to?: Date },
) {
  const where: Prisma.TimeOffRequestWhereInput = {
    companyId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.from ? { endDate: { gte: filters.from } } : {}),
    ...(filters.to ? { startDate: { lte: filters.to } } : {}),
  };

  const requests = await prisma.timeOffRequest.findMany({
    where,
    include: {
      employee: { select: { firstName: true, lastName: true } },
      type: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    typeId: r.typeId,
    typeName: r.type.name,
    startDate: r.startDate,
    endDate: r.endDate,
    halfDay: r.halfDay,
    days: r.days.toFixed(1),
    reason: r.reason,
    attachmentUrl: r.attachmentUrl,
    status: r.status,
    decidedById: r.decidedById,
    decidedAt: r.decidedAt,
    decisionComment: r.decisionComment,
    createdAt: r.createdAt,
  }));
}

export async function decideRequest(
  id: string,
  companyId: string,
  actorId: string,
  input: DecideTimeOffRequestInput,
) {
  if (input.decision === "REFUSED" && !input.comment) {
    throw new ApiError(400, "COMMENT_REQUIRED", "A comment is required to reject a request");
  }

  const request = await prisma.timeOffRequest.findFirst({ where: { id, companyId } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Request not found");

  const result = await prisma.$transaction(async (tx) => {
    // Guard the race: only one decision wins.
    const updateResult = await tx.timeOffRequest.updateMany({
      where: { id, status: "TO_APPROVE" },
      data: {
        status: input.decision,
        decidedById: actorId,
        decidedAt: new Date(),
        decisionComment: input.comment,
      },
    });
    if (updateResult.count !== 1) {
      throw new ApiError(409, "ALREADY_DECIDED", "This request has already been decided");
    }

    if (input.decision === "APPROVED") {
      // Upsert ON_LEAVE attendance for every covered day.
      for (let d = new Date(request.startDate); d <= request.endDate;) {
        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: request.employeeId, date: d } },
          create: {
            companyId,
            employeeId: request.employeeId,
            date: new Date(d),
            status: "ON_LEAVE",
            source: "SYSTEM",
          },
          update: { status: "ON_LEAVE" },
        });
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    return tx.timeOffRequest.findUniqueOrThrow({ where: { id } });
  });

  await writeAudit({
    companyId,
    actorId,
    action: `TIME_OFF_${input.decision}`,
    entity: "TimeOffRequest",
    entityId: id,
    before: { status: "TO_APPROVE" },
    after: { status: input.decision, comment: input.comment },
  });

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: request.employeeId } });
  await notify({
    companyId,
    userIds: [employee.userId],
    type: "TIME_OFF_DECIDED",
    title: `Time off ${input.decision === "APPROVED" ? "approved" : "refused"}`,
    body: input.comment ?? undefined,
    link: "/time-off",
  });

  return result;
}

export async function cancelRequest(
  id: string,
  companyId: string,
  actorId: string,
  actorEmployeeId: string | null,
  isPrivileged: boolean,
) {
  const request = await prisma.timeOffRequest.findFirst({ where: { id, companyId } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Request not found");

  if (!isPrivileged && request.employeeId !== actorEmployeeId) {
    throw new ApiError(403, "FORBIDDEN", "You don't have access to this");
  }
  if (!isPrivileged && request.status !== "TO_APPROVE") {
    throw new ApiError(400, "CANNOT_CANCEL", "Only pending requests can be cancelled");
  }

  await prisma.$transaction(async (tx) => {
    await tx.timeOffRequest.update({ where: { id }, data: { status: "CANCELLED" } });

    if (request.status === "APPROVED") {
      // Reverse ON_LEAVE attendance for covered days.
      for (let d = new Date(request.startDate); d <= request.endDate;) {
        await tx.attendanceRecord.updateMany({
          where: { employeeId: request.employeeId, date: d, status: "ON_LEAVE" },
          data: { status: "ABSENT" },
        });
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  });

  await writeAudit({
    companyId,
    actorId,
    action: "TIME_OFF_CANCELLED",
    entity: "TimeOffRequest",
    entityId: id,
    before: { status: request.status },
    after: { status: "CANCELLED" },
  });

  return { cancelled: true };
}

// ---------------------------------------------------------------------------
// Calendar (year grid)
// ---------------------------------------------------------------------------

export async function getCalendar(companyId: string, employeeId: string, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const requests = await prisma.timeOffRequest.findMany({
    where: {
      companyId,
      employeeId,
      status: { in: ["TO_APPROVE", "APPROVED"] },
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
    include: { type: true },
  });

  const days: {
    date: string;
    typeCode: string;
    colorToken: string | null;
    status: string;
    requestId: string;
  }[] = [];
  for (const r of requests) {
    for (
      let d = new Date(Math.max(r.startDate.getTime(), yearStart.getTime()));
      d <= r.endDate && d <= yearEnd;
    ) {
      days.push({
        date: d.toISOString().slice(0, 10),
        typeCode: r.type.code,
        colorToken: r.type.colorToken,
        status: r.status,
        requestId: r.id,
      });
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return days;
}
