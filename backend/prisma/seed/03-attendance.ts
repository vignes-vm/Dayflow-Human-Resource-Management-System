// M4 — 90 days of back-dated attendance with realistic variance (half-days,
// unexcused absences, an early bird and a latecomer, genuine extra hours).
// See docs/Dayflow-Blueprint-v2.md §14.1 and docs/Dayflow-ClaudeCode-Prompts-v2.md Step 20.
import { prisma } from "../../src/lib/prisma.js";
import { computeMinutes, deriveStatus } from "../../src/engines/attendanceStatus.js";

const DAYS_BACK = 90;

function utcDate(base: Date, offsetDays: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function seed(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { name: "Odoo India" } });
  if (!company) {
    console.log("  03-attendance: Company not found. Skip.");
    return;
  }

  const existing = await prisma.attendanceRecord.findFirst({ where: { companyId: company.id } });
  if (existing) {
    console.log("  03-attendance: already seeded — skipping");
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
  });
  if (employees.length === 0) {
    console.log("  03-attendance: no employees found. Skip.");
    return;
  }

  const standardMinutes = company.standardDailyHours * 60;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const holidays = await prisma.holiday.findMany({
    where: { companyId: company.id, date: { gte: utcDate(today, DAYS_BACK), lte: today } },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  const earlyBird = employees.find((e) => e.firstName === "Amit")?.id;
  const latecomer = employees.find((e) => e.firstName === "Priya")?.id;

  // Pick a few employee+day combos for scripted variance.
  const halfDayCombos = new Set<string>();
  const absenceCombos = new Set<string>();
  const extraHoursCombos = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const emp = employees[(i * 3) % employees.length]!;
    halfDayCombos.add(`${emp.id}:${10 + i * 20}`);
  }
  for (let i = 0; i < 2; i++) {
    const emp = employees[(i * 5 + 1) % employees.length]!;
    absenceCombos.add(`${emp.id}:${15 + i * 25}`);
  }
  for (let i = 0; i < 6; i++) {
    const emp = employees[i % employees.length]!;
    extraHoursCombos.add(`${emp.id}:${5 + i * 12}`);
  }

  const recordsData: {
    companyId: string;
    employeeId: string;
    date: Date;
    status: string;
    firstCheckIn: Date | null;
    lastCheckOut: Date | null;
    workMinutes: number;
    breakMinutes: number;
    extraMinutes: number;
    source: "SYSTEM";
  }[] = [];

  for (let offset = DAYS_BACK; offset >= 1; offset--) {
    const date = utcDate(today, offset);
    const dow = date.getUTCDay();
    const isWorkingDay = dow >= 1 && dow <= company.workDaysPerWeek;
    const isHoliday = holidaySet.has(date.toISOString().slice(0, 10));

    for (const emp of employees) {
      const key = `${emp.id}:${offset}`;

      if (!isWorkingDay) {
        recordsData.push({
          companyId: company.id,
          employeeId: emp.id,
          date,
          status: "WEEKEND",
          firstCheckIn: null,
          lastCheckOut: null,
          workMinutes: 0,
          breakMinutes: 0,
          extraMinutes: 0,
          source: "SYSTEM",
        });
        continue;
      }
      if (isHoliday) {
        recordsData.push({
          companyId: company.id,
          employeeId: emp.id,
          date,
          status: "HOLIDAY",
          firstCheckIn: null,
          lastCheckOut: null,
          workMinutes: 0,
          breakMinutes: 0,
          extraMinutes: 0,
          source: "SYSTEM",
        });
        continue;
      }
      if (absenceCombos.has(key)) {
        recordsData.push({
          companyId: company.id,
          employeeId: emp.id,
          date,
          status: "ABSENT",
          firstCheckIn: null,
          lastCheckOut: null,
          workMinutes: 0,
          breakMinutes: 0,
          extraMinutes: 0,
          source: "SYSTEM",
        });
        continue;
      }

      const checkInHour = emp.id === earlyBird ? 8 : emp.id === latecomer ? 10.5 : 9;
      const checkInMinutes = Math.round(checkInHour * 60);
      const isHalfDay = halfDayCombos.has(key);
      const isExtra = extraHoursCombos.has(key);
      const workMinutes = isHalfDay
        ? Math.round(standardMinutes * 0.4)
        : isExtra
          ? standardMinutes + 90
          : standardMinutes;

      const inAt = new Date(date);
      inAt.setUTCMinutes(inAt.getUTCMinutes() + checkInMinutes);
      const outAt = new Date(inAt);
      outAt.setUTCMinutes(outAt.getUTCMinutes() + workMinutes + company.breakMinutes);

      const minutes = computeMinutes([{ inAt, outAt }], standardMinutes);
      const status = deriveStatus({
        workMinutes: minutes.workMinutes,
        standardDailyMinutes: standardMinutes,
        hasApprovedLeave: false,
        isHoliday: false,
        isWorkingDay: true,
      });

      recordsData.push({
        companyId: company.id,
        employeeId: emp.id,
        date,
        status,
        firstCheckIn: inAt,
        lastCheckOut: outAt,
        workMinutes: minutes.workMinutes,
        breakMinutes: minutes.breakMinutes,
        extraMinutes: minutes.extraMinutes,
        source: "SYSTEM",
      });
    }
  }

  // Insert in batches with sessions, since createMany can't nest relations.
  const BATCH = 200;
  for (let i = 0; i < recordsData.length; i += BATCH) {
    const batch = recordsData.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.attendanceRecord.create({
          data: {
            ...r,
            status: r.status as never,
            sessions: r.firstCheckIn
              ? { create: [{ inAt: r.firstCheckIn, outAt: r.lastCheckOut }] }
              : undefined,
          },
        }),
      ),
    );
  }

  console.log(
    `  03-attendance: seeded ${recordsData.length} records across ${employees.length} employees`,
  );
}
