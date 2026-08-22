import bcrypt from "bcryptjs";
import { startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Prisma } from "@prisma/client";

import { buildLoginId } from "@/engines/loginId.js";
import { writeAudit } from "@/lib/audit.js";
import { allocateSerial } from "@/lib/loginIdCounter.js";
import { sendCredentialsEmail } from "@/lib/mailer.js";
import { prisma } from "@/lib/prisma.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type {
  CreateEmployeeInput,
  AdminUpdateEmployeeInput,
  ListEmployeesQuery,
  EmployeeCard,
} from "@dayflow/shared";

const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a readable temporary password (12 chars, no ambiguous glyphs). */
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%!";
  const all = upper + lower + digits + symbols;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]!;

  // Guarantee at least one of each required class
  const guaranteed = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  return [...guaranteed, ...rest].sort(() => Math.random() - 0.5).join("");
}

// ---------------------------------------------------------------------------
// Presence computation — batch, no N+1
// ---------------------------------------------------------------------------

type PresenceState = "GREEN" | "AIRPLANE" | "YELLOW" | "RED";

interface PresenceContext {
  /** Today's date in the company timezone, as a Date at midnight UTC for Prisma comparison */
  todayUtc: Date;
  /** Company absence cutoff hour in local time (e.g. 11) */
  absenceCutoffHour: number;
  /** Set of employee IDs with an open AttendanceSession today (checked in) */
  checkedInIds: Set<string>;
  /** Set of employee IDs with an approved TimeOffRequest covering today */
  onLeaveIds: Set<string>;
}

function derivePresence(employeeId: string, ctx: PresenceContext): PresenceState {
  if (ctx.checkedInIds.has(employeeId)) return "GREEN";
  if (ctx.onLeaveIds.has(employeeId)) return "AIRPLANE";

  const nowHour = new Date().getHours(); // local server time — good enough for cutoff
  if (nowHour >= ctx.absenceCutoffHour) return "YELLOW";
  return "RED";
}

async function buildPresenceContext(companyId: string, timezone: string): Promise<PresenceContext> {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  const todayStart = startOfDay(localNow);

  // Convert back to a UTC-compatible Date for Prisma's @db.Date column
  const todayUtc = new Date(
    Date.UTC(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate()),
  );

  // Batch 1: all employees who have an open (outAt=null) AttendanceSession today
  const openSessions = await prisma.attendanceSession.findMany({
    where: {
      outAt: null,
      attendanceRecord: {
        companyId,
        date: todayUtc,
      },
    },
    select: { attendanceRecord: { select: { employeeId: true } } },
  });

  // Batch 2: all employees with an approved time-off request covering today
  const approvedLeaves = await prisma.timeOffRequest.findMany({
    where: {
      companyId,
      status: "APPROVED",
      startDate: { lte: todayUtc },
      endDate: { gte: todayUtc },
    },
    select: { employeeId: true },
  });

  // Fetch company absence cutoff
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { absenceCutoffHour: true },
  });

  return {
    todayUtc,
    absenceCutoffHour: company.absenceCutoffHour,
    checkedInIds: new Set(
      openSessions.map(
        (s: { attendanceRecord: { employeeId: string } }) => s.attendanceRecord.employeeId,
      ),
    ),
    onLeaveIds: new Set(approvedLeaves.map((r: { employeeId: string }) => r.employeeId)),
  };
}

// ---------------------------------------------------------------------------
// List employees (card grid)
// ---------------------------------------------------------------------------

export async function listEmployees(companyId: string, query: ListEmployeesQuery) {
  const { search, departmentId, presence, page, pageSize } = query;

  const where = {
    companyId,
    status: "ACTIVE",
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { jobTitle: { contains: search, mode: "insensitive" } },
            { user: { loginId: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [employees, total, company] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { timezone: true },
    }),
  ]);

  const ctx = await buildPresenceContext(companyId, company.timezone);

  let cards: EmployeeCard[] = employees.map((emp) => ({
    id: emp.id,
    userId: emp.userId,
    firstName: emp.firstName,
    lastName: emp.lastName,
    avatarUrl: emp.avatarUrl,
    jobTitle: emp.jobTitle,
    department: emp.department ? { id: emp.department.id, name: emp.department.name } : null,
    presence: derivePresence(emp.id, ctx),
  }));

  // Filter by presence state if requested (in-memory after computation)
  if (presence) {
    cards = cards.filter((c) => c.presence === presence);
  }

  return {
    data: cards,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ---------------------------------------------------------------------------
// Get single employee (role-shaped)
// ---------------------------------------------------------------------------

export async function getEmployee(
  employeeId: string,
  viewerCompanyId: string,
  viewerRole: "ADMIN" | "HR" | "EMPLOYEE",
  viewerEmployeeId: string | null,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    include: {
      user: { select: { loginId: true, email: true, phone: true, role: true, status: true } },
      department: { select: { id: true, name: true } },
      manager: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });

  if (!employee) {
    throw new ApiError(404, "NOT_FOUND", "Employee not found");
  }

  const isPrivileged = viewerRole === "ADMIN" || viewerRole === "HR";
  const isSelf = employee.id === viewerEmployeeId;

  const base = {
    id: employee.id,
    userId: employee.userId,
    loginId: employee.user.loginId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    avatarUrl: employee.avatarUrl,
    email: employee.user.email,
    phone: employee.user.phone,
    jobTitle: employee.jobTitle,
    workLocation: employee.workLocation,
    role: employee.user.role,
    status: employee.status,
    joinedOn: employee.joinedOn,
    department: employee.department,
    manager: employee.manager,
  };

  // Non-privileged viewer looking at someone else — strip sensitive fields
  if (!isPrivileged && !isSelf) {
    return {
      ...base,
      // Salary info, private info, and security fields are omitted server-side.
      // The frontend gets nothing sensitive in the payload at all.
      email: null as unknown as string, // email redacted for non-self employee view
      phone: null,
    };
  }

  return base;
}

// ---------------------------------------------------------------------------
// Create employee
// ---------------------------------------------------------------------------

export async function createEmployee(
  companyId: string,
  actorId: string,
  input: CreateEmployeeInput,
) {
  const email = input.email.toLowerCase();

  // Check email uniqueness first (outside transaction for a cheap early exit)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists", "email");
  }

  const joiningYear = input.joinedOn.getFullYear();
  const temporaryPassword = generatePassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { code: true, serialWidth: true },
  });

  const { employee, user } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Row-level locking via allocateSerial ensures sequential Login IDs even
    // under concurrent requests.
    let serial = await allocateSerial(tx, companyId, joiningYear);
    let loginId = buildLoginId({
      companyCode: company.code,
      firstName: input.firstName,
      lastName: input.lastName ?? "",
      joiningYear,
      serial,
      serialWidth: company.serialWidth,
    });

    // Deduplicate if collision (rare but possible with short names)
    for (let attempt = 0; await tx.user.findUnique({ where: { loginId } }); attempt++) {
      if (attempt >= 20) {
        throw new ApiError(
          409,
          "LOGIN_ID_COLLISION",
          "Could not generate a unique Login ID — try adjusting the company code",
        );
      }
      serial = await allocateSerial(tx, companyId, joiningYear);
      loginId = buildLoginId({
        companyCode: company.code,
        firstName: input.firstName,
        lastName: input.lastName ?? "",
        joiningYear,
        serial,
        serialWidth: company.serialWidth,
      });
    }

    const newUser = await tx.user.create({
      data: {
        companyId,
        loginId,
        email,
        phone: input.phone,
        passwordHash,
        role: input.role,
        status: "ACTIVE",
        mustChangePassword: true,
        // Employees don't go through email verification — admin creates them directly
        emailVerifiedAt: new Date(),
      },
    });

    const newEmployee = await tx.employee.create({
      data: {
        userId: newUser.id,
        companyId,
        firstName: input.firstName,
        lastName: input.lastName ?? "",
        departmentId: input.departmentId ?? null,
        managerId: input.managerId ?? null,
        jobTitle: input.jobTitle,
        workLocation: input.workLocation ?? "OFFICE",
        joinedOn: input.joinedOn,
        joiningYear,
        joiningSerial: serial,
      },
    });

    // Create empty Resume and PrivateInfo rows for completeness
    await tx.resume.create({ data: { employeeId: newEmployee.id } });
    await tx.privateInfo.create({ data: { employeeId: newEmployee.id } });

    // Seed default TimeOffAllocations from company's active TimeOffTypes
    const timeOffTypes = await tx.timeOffType.findMany({ where: { companyId } });
    if (timeOffTypes.length > 0) {
      const today = new Date();
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);

      await tx.timeOffAllocation.createMany({
        data: timeOffTypes.map(
          (t: { id: string; defaultAllocationDays: Prisma.Decimal | number }) => ({
            companyId,
            employeeId: newEmployee.id,
            typeId: t.id,
            days: t.defaultAllocationDays,
            validFrom: yearStart,
            validTo: yearEnd,
            status: "APPROVED" as const,
            allocatedById: actorId,
            note: "Default allocation on hire",
          }),
        ),
      });
    }

    return { employee: newEmployee, user: newUser };
  });

  // Audit and email outside the transaction so a mailer failure doesn't roll back the record
  await writeAudit({
    companyId,
    actorId,
    action: "EMPLOYEE_CREATED",
    entity: "Employee",
    entityId: employee.id,
    after: {
      loginId: user.loginId,
      name: `${employee.firstName} ${employee.lastName}`,
      email,
      role: input.role,
    },
  });

  const mail = await sendCredentialsEmail(email, {
    name: `${input.firstName} ${input.lastName ?? ""}`.trim(),
    loginId: user.loginId,
    password: temporaryPassword,
    appUrl: process.env.APP_URL ?? "http://localhost:5173",
  });

  return {
    employee: {
      id: employee.id,
      loginId: user.loginId,
    },
    credentials: {
      loginId: user.loginId,
      temporaryPassword,
      email,
      emailPreviewUrl: mail.previewUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// Update employee (admin path)
// ---------------------------------------------------------------------------

export async function adminUpdateEmployee(
  employeeId: string,
  companyId: string,
  actorId: string,
  input: AdminUpdateEmployeeInput,
) {
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    include: { user: { select: { email: true, role: true, status: true } } },
  });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const before = {
    firstName: existing.firstName,
    lastName: existing.lastName,
    jobTitle: existing.jobTitle,
    departmentId: existing.departmentId,
    role: existing.user.role,
    status: existing.status,
  };

  const { status, role, email, phone, ...empFields } = input;

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...empFields,
        ...(status ? { status } : {}),
      },
    }),
    ...(role || email || phone !== undefined
      ? [
          prisma.user.update({
            where: { id: existing.userId },
            data: {
              ...(role ? { role } : {}),
              ...(email ? { email: email.toLowerCase() } : {}),
              ...(phone !== undefined ? { phone } : {}),
            },
          }),
        ]
      : []),
  ]);

  await writeAudit({
    companyId,
    actorId,
    action: "EMPLOYEE_UPDATED",
    entity: "Employee",
    entityId: employeeId,
    before,
    after: input,
  });
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartments(companyId: string) {
  const departments = await prisma.department.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: {
      employees: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  });

  // Fetch head employee info separately (Department has headEmployeeId, not a relation)
  const headIds = departments
    .map((d: { headEmployeeId: string | null }) => d.headEmployeeId)
    .filter(Boolean) as string[];
  const heads = headIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: headIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const headMap = new Map(heads.map((h) => [h.id, h]));

  return departments.map(
    (d: {
      id: string;
      name: string;
      headEmployeeId: string | null;
      employees: { id: string }[];
    }) => ({
      id: d.id,
      name: d.name,
      head: d.headEmployeeId ? (headMap.get(d.headEmployeeId) ?? null) : null,
      employeeCount: d.employees.length,
    }),
  );
}

export async function createDepartment(
  companyId: string,
  actorId: string,
  data: { name: string; headEmployeeId?: string | null },
) {
  const dept = await prisma.department.create({
    data: { companyId, name: data.name, headEmployeeId: data.headEmployeeId ?? null },
  });

  await writeAudit({
    companyId,
    actorId,
    action: "DEPARTMENT_CREATED",
    entity: "Department",
    entityId: dept.id,
    after: { name: dept.name },
  });

  return dept;
}

export async function updateDepartment(
  deptId: string,
  companyId: string,
  actorId: string,
  data: { name?: string; headEmployeeId?: string | null },
) {
  const existing = await prisma.department.findFirst({ where: { id: deptId, companyId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Department not found");

  const updated = await prisma.department.update({
    where: { id: deptId },
    data: { ...data },
  });

  await writeAudit({
    companyId,
    actorId,
    action: "DEPARTMENT_UPDATED",
    entity: "Department",
    entityId: deptId,
    before: { name: existing.name, headEmployeeId: existing.headEmployeeId },
    after: data,
  });

  return updated;
}
