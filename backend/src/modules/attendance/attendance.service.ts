import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { companyToday, parseDateOnly } from "@/lib/dates.js";
import { computeMinutes, deriveStatus } from "@/engines/attendanceStatus.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type {
  AttendanceDayRow,
  AttendanceRecordDto,
  AttendanceSummary,
  RegularizeAttendanceInput,
} from "@dayflow/shared";

async function getCompanySettings(companyId: string) {
  return prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      timezone: true,
      workDaysPerWeek: true,
      standardDailyHours: true,
      absenceCutoffHour: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Check in / out
// ---------------------------------------------------------------------------

export async function checkIn(companyId: string, employeeId: string) {
  const company = await getCompanySettings(companyId);
  const today = companyToday(company.timezone);

  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceSession.findFirst({
      where: { outAt: null, attendanceRecord: { employeeId, date: today } },
    });
    if (existing) {
      throw new ApiError(409, "ALREADY_CHECKED_IN", "You're already checked in");
    }

    const attendanceRecord = await tx.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: { companyId, employeeId, date: today, status: "PRESENT", source: "SELF" },
      update: {},
    });

    await tx.attendanceSession.create({
      data: { attendanceRecordId: attendanceRecord.id, inAt: new Date() },
    });

    return attendanceRecord;
  });

  return { recordId: record.id };
}

export async function checkOut(companyId: string, employeeId: string) {
  const company = await getCompanySettings(companyId);
  const today = companyToday(company.timezone);
  const standardMinutes = company.standardDailyHours * 60;

  await prisma.$transaction(async (tx) => {
    const openSession = await tx.attendanceSession.findFirst({
      where: { outAt: null, attendanceRecord: { employeeId, date: today } },
      include: { attendanceRecord: { include: { sessions: true } } },
    });
    if (!openSession) {
      throw new ApiError(409, "NOT_CHECKED_IN", "You're not checked in");
    }

    const now = new Date();
    await tx.attendanceSession.update({ where: { id: openSession.id }, data: { outAt: now } });

    const sessions = openSession.attendanceRecord.sessions
      .map((s) => ({
        inAt: s.inAt,
        outAt: s.id === openSession.id ? now : s.outAt,
      }))
      .sort((a, b) => a.inAt.getTime() - b.inAt.getTime());
    const minutes = computeMinutes(sessions, standardMinutes);

    await tx.attendanceRecord.update({
      where: { id: openSession.attendanceRecord.id },
      data: {
        firstCheckIn: sessions[0]?.inAt,
        lastCheckOut: now,
        workMinutes: minutes.workMinutes,
        breakMinutes: minutes.breakMinutes,
        extraMinutes: minutes.extraMinutes,
        status: "PRESENT",
      },
    });
  });

  return { checkedOut: true };
}

/** Powers the systray control and the presence dot for the signed-in user. */
export async function getMyToday(companyId: string, employeeId: string) {
  const company = await getCompanySettings(companyId);
  const today = companyToday(company.timezone);

  const [openSession, approvedLeave] = await Promise.all([
    prisma.attendanceSession.findFirst({
      where: { outAt: null, attendanceRecord: { employeeId, date: today } },
    }),
    prisma.timeOffRequest.findFirst({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
  ]);

  const hasOpenSession = !!openSession;
  const nowHour = new Date().getHours();

  let presence: "GREEN" | "AIRPLANE" | "YELLOW" | "RED";
  if (hasOpenSession) presence = "GREEN";
  else if (approvedLeave) presence = "AIRPLANE";
  else if (nowHour >= company.absenceCutoffHour) presence = "YELLOW";
  else presence = "RED";

  return {
    hasOpenSession,
    presence,
    onApprovedLeave: !!approvedLeave,
    checkedInAt: openSession?.inAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// My attendance (day-wise, month view)
// ---------------------------------------------------------------------------

export async function getMyAttendance(
  companyId: string,
  employeeId: string,
  month?: string,
): Promise<AttendanceRecordDto[]> {
  const company = await getCompanySettings(companyId);
  const now = month ? new Date(`${month}-01T00:00:00.000Z`) : companyToday(company.timezone);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, employeeId, date: { gte: monthStart, lte: monthEnd } },
    include: { sessions: { orderBy: { inAt: "asc" } } },
    orderBy: { date: "asc" },
  });

  return records.map((r) => ({
    id: r.id,
    date: r.date,
    status: r.status,
    firstCheckIn: r.firstCheckIn,
    lastCheckOut: r.lastCheckOut,
    workMinutes: r.workMinutes,
    breakMinutes: r.breakMinutes,
    extraMinutes: r.extraMinutes,
    source: r.source,
    note: r.note,
    editedById: r.editedById,
    editedAt: r.editedAt,
    sessions: r.sessions.map((s) => ({ id: s.id, inAt: s.inAt, outAt: s.outAt })),
  }));
}

// ---------------------------------------------------------------------------
// Admin day view — every employee for one date
// ---------------------------------------------------------------------------

export async function getDayView(
  companyId: string,
  date: string,
  departmentId?: string,
): Promise<AttendanceDayRow[]> {
  const day = parseDateOnly(date);

  const where: Prisma.EmployeeWhereInput = {
    companyId,
    status: "ACTIVE",
    ...(departmentId ? { departmentId } : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: { select: { loginId: true } },
      department: { select: { name: true } },
      attendanceRecords: {
        where: { date: day },
        include: { sessions: true },
      },
    },
    orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
  });

  return employees.map((emp) => {
    const record = emp.attendanceRecords[0];
    return {
      recordId: record?.id ?? null,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      loginId: emp.user.loginId,
      department: emp.department?.name ?? null,
      status: record?.status ?? "ABSENT",
      firstCheckIn: record?.firstCheckIn ?? null,
      lastCheckOut: record?.lastCheckOut ?? null,
      workMinutes: record?.workMinutes ?? 0,
      extraMinutes: record?.extraMinutes ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Regularisation (ADMIN/HR)
// ---------------------------------------------------------------------------

export async function regularizeAttendance(
  recordId: string,
  companyId: string,
  actorId: string,
  input: RegularizeAttendanceInput,
) {
  const before = await prisma.attendanceRecord.findFirst({ where: { id: recordId, companyId } });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Attendance record not found");

  const company = await getCompanySettings(companyId);
  const standardMinutes = company.standardDailyHours * 60;

  const updated = await prisma.$transaction(async (tx) => {
    const data: Prisma.AttendanceRecordUpdateInput = {
      source: "ADMIN",
      editedById: actorId,
      editedAt: new Date(),
      note: input.reason,
    };

    if (input.firstCheckIn !== undefined) data.firstCheckIn = input.firstCheckIn;
    if (input.lastCheckOut !== undefined) data.lastCheckOut = input.lastCheckOut;

    if (input.firstCheckIn && input.lastCheckOut) {
      const minutes = computeMinutes(
        [{ inAt: input.firstCheckIn, outAt: input.lastCheckOut }],
        standardMinutes,
      );
      data.workMinutes = minutes.workMinutes;
      data.breakMinutes = minutes.breakMinutes;
      data.extraMinutes = minutes.extraMinutes;
    }

    if (input.status) data.status = input.status;

    return tx.attendanceRecord.update({ where: { id: recordId }, data });
  });

  await writeAudit({
    companyId,
    actorId,
    action: "ATTENDANCE_REGULARIZED",
    entity: "AttendanceRecord",
    entityId: recordId,
    before: { status: before.status, workMinutes: before.workMinutes },
    after: { status: updated.status, workMinutes: updated.workMinutes, reason: input.reason },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Summary — days present, leaves, total working days
// ---------------------------------------------------------------------------

export async function getSummary(
  companyId: string,
  employeeId: string,
  month?: string,
): Promise<AttendanceSummary> {
  const company = await getCompanySettings(companyId);
  const now = month ? new Date(`${month}-01T00:00:00.000Z`) : companyToday(company.timezone);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, employeeId, date: { gte: monthStart, lte: monthEnd } },
  });

  const daysPresent = records.filter(
    (r) => r.status === "PRESENT" || r.status === "HALF_DAY",
  ).length;
  const leavesCount = records.filter((r) => r.status === "ON_LEAVE").length;
  const totalWorkingDays = records.filter(
    (r) => r.status !== "WEEKEND" && r.status !== "HOLIDAY",
  ).length;
  const totalMinutes = records.reduce((sum, r) => sum + r.workMinutes, 0);
  const totalExtraMinutes = records.reduce((sum, r) => sum + r.extraMinutes, 0);

  return {
    daysPresent,
    leavesCount,
    totalWorkingDays,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalExtraHours: Math.round((totalExtraMinutes / 60) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Daily close job — derives final status for every employee for a given
// date (default: today in the company's timezone). Idempotent.
// ---------------------------------------------------------------------------

export async function closeAttendanceDay(companyId: string, date?: Date): Promise<void> {
  const company = await getCompanySettings(companyId);
  const targetDate = date ?? companyToday(company.timezone);
  const standardMinutes = company.standardDailyHours * 60;
  const dayOfWeek = targetDate.getUTCDay();
  const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= company.workDaysPerWeek;

  const [employees, holiday, approvedLeaves] = await Promise.all([
    prisma.employee.findMany({ where: { companyId, status: "ACTIVE" }, select: { id: true } }),
    prisma.holiday.findFirst({ where: { companyId, date: targetDate } }),
    prisma.timeOffRequest.findMany({
      where: {
        companyId,
        status: "APPROVED",
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      select: { employeeId: true },
    }),
  ]);
  const onLeaveIds = new Set(approvedLeaves.map((r) => r.employeeId));

  for (const emp of employees) {
    await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: targetDate } },
        include: { sessions: true },
      });

      // Auto-close any still-open session (missed checkout).
      const openSessions = record?.sessions.filter((s) => !s.outAt) ?? [];
      for (const s of openSessions) {
        await tx.attendanceSession.update({
          where: { id: s.id },
          data: { outAt: record!.lastCheckOut ?? new Date(s.inAt.getTime()) },
        });
      }

      const sessions = record
        ? record.sessions.map((s) => ({
            inAt: s.inAt,
            outAt: openSessions.some((o) => o.id === s.id) ? new Date() : s.outAt,
          }))
        : [];
      const minutes = computeMinutes(sessions, standardMinutes);

      const status = deriveStatus({
        workMinutes: minutes.workMinutes,
        standardDailyMinutes: standardMinutes,
        hasApprovedLeave: onLeaveIds.has(emp.id),
        isHoliday: !!holiday,
        isWorkingDay,
      });

      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: targetDate } },
        create: {
          companyId,
          employeeId: emp.id,
          date: targetDate,
          status,
          workMinutes: minutes.workMinutes,
          breakMinutes: minutes.breakMinutes,
          extraMinutes: minutes.extraMinutes,
          source: "SYSTEM",
        },
        update: {
          status,
          workMinutes: minutes.workMinutes,
          breakMinutes: minutes.breakMinutes,
          extraMinutes: minutes.extraMinutes,
        },
      });
    });
  }
}
