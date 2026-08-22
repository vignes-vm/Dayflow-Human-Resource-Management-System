// M4 — allocations, 14 time-off requests including two overlapping requests
// in the same department so the Coverage Radar shows a risk day out of the
// box, and the Indian public holiday calendar.
// See docs/Dayflow-Blueprint-v2.md §14.1 and docs/Dayflow-ClaudeCode-Prompts-v2.md Step 20.
import { prisma } from "../../src/lib/prisma.js";

const HOLIDAYS_2026 = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function daysAhead(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export async function seed(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { name: "Odoo India" } });
  if (!company) {
    console.log("  04-timeoff: Company not found. Skip.");
    return;
  }

  const existing = await prisma.holiday.findFirst({ where: { companyId: company.id } });
  if (existing) {
    console.log("  04-timeoff: already seeded — skipping");
    return;
  }

  await prisma.holiday.createMany({
    data: HOLIDAYS_2026.map((h) => ({
      companyId: company.id,
      date: new Date(`${h.date}T00:00:00.000Z`),
      name: h.name,
    })),
  });

  const [paidType, sickType] = await Promise.all([
    prisma.timeOffType.findFirst({ where: { companyId: company.id, code: "PAID" } }),
    prisma.timeOffType.findFirst({ where: { companyId: company.id, code: "SICK" } }),
  ]);
  if (!paidType || !sickType) {
    console.log("  04-timeoff: time off types not found. Skip.");
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, status: "ACTIVE" },
    select: { id: true, firstName: true, departmentId: true },
  });
  const engineering = employees.filter((e) => ["Amit", "Priya", "Sara"].includes(e.firstName));

  const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: "ADMIN" } });
  if (!admin) {
    console.log("  04-timeoff: admin not found. Skip.");
    return;
  }

  const requests: {
    employeeId: string;
    typeId: string;
    startDate: Date;
    endDate: Date;
    days: number;
    status: "TO_APPROVE" | "APPROVED" | "REFUSED";
    reason?: string;
    attachmentUrl?: string;
    decidedById?: string;
    decidedAt?: Date;
    decisionComment?: string;
  }[] = [];

  // Two overlapping pending requests in the same department (Engineering) —
  // this is what makes the Coverage Radar show a risk day out of the box.
  if (engineering.length >= 2) {
    requests.push({
      employeeId: engineering[0]!.id,
      typeId: paidType.id,
      startDate: daysAhead(5),
      endDate: daysAhead(7),
      days: 3,
      status: "TO_APPROVE",
      reason: "Family trip",
    });
    requests.push({
      employeeId: engineering[1]!.id,
      typeId: paidType.id,
      startDate: daysAhead(6),
      endDate: daysAhead(8),
      days: 3,
      status: "TO_APPROVE",
      reason: "Wedding",
    });
  }

  // 5 more TO_APPROVE, spread across employees.
  for (let i = 2; i < 7; i++) {
    const emp = employees[i % employees.length]!;
    requests.push({
      employeeId: emp.id,
      typeId: paidType.id,
      startDate: daysAhead(10 + i * 2),
      endDate: daysAhead(11 + i * 2),
      days: 2,
      status: "TO_APPROVE",
      reason: "Personal time",
    });
  }

  // 5 approved (past), decided by the admin.
  for (let i = 0; i < 5; i++) {
    const emp = employees[(i + 3) % employees.length]!;
    requests.push({
      employeeId: emp.id,
      typeId: paidType.id,
      startDate: daysAgo(30 + i * 5),
      endDate: daysAgo(29 + i * 5),
      days: 2,
      status: "APPROVED",
      reason: "Approved leave",
      decidedById: admin.id,
      decidedAt: daysAgo(31 + i * 5),
    });
  }

  // 2 refused, with comments.
  for (let i = 0; i < 2; i++) {
    const emp = employees[(i + 8) % employees.length]!;
    requests.push({
      employeeId: emp.id,
      typeId: paidType.id,
      startDate: daysAgo(15 + i * 3),
      endDate: daysAgo(14 + i * 3),
      days: 2,
      status: "REFUSED",
      reason: "Requested time off",
      decidedById: admin.id,
      decidedAt: daysAgo(16 + i * 3),
      decisionComment: "Team is short-staffed that week — please pick different dates.",
    });
  }

  // 1 sick request with an attached certificate.
  const sickEmployee = employees[10 % employees.length]!;
  requests.push({
    employeeId: sickEmployee.id,
    typeId: sickType.id,
    startDate: daysAgo(5),
    endDate: daysAgo(4),
    days: 2,
    status: "APPROVED",
    reason: "Fever",
    attachmentUrl: "/uploads/documents/sample-certificate.pdf",
    decidedById: admin.id,
    decidedAt: daysAgo(6),
  });

  await prisma.timeOffRequest.createMany({
    data: requests.map((r) => ({
      companyId: company.id,
      employeeId: r.employeeId,
      typeId: r.typeId,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      status: r.status,
      reason: r.reason,
      attachmentUrl: r.attachmentUrl,
      decidedById: r.decidedById,
      decidedAt: r.decidedAt,
      decisionComment: r.decisionComment,
    })),
  });

  console.log(
    `  04-timeoff: seeded ${HOLIDAYS_2026.length} holidays and ${requests.length} time-off requests`,
  );
}
