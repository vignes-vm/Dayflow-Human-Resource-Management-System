import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { computePayslip } from "@/engines/payslip.js";
import { generatePayslipPdf } from "@/lib/pdf.js";
import { sendPayslipReadyEmail } from "@/lib/mailer.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type { ComponentCategory, ComponentComputation } from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Run Payroll (DRAFT generation)
// ---------------------------------------------------------------------------

export async function runPayroll(companyId: string, actorId: string, month: number, year: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // 1. Fetch Company Settings & Active Employees
  const [company, employees, timeOffTypes, holidays] = await Promise.all([
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        name: true,
        pfRateEmployee: true,
        professionalTax: true,
        workDaysPerWeek: true,
      },
    }),
    prisma.employee.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { loginId: true } },
      },
    }),
    prisma.timeOffType.findMany({
      where: { companyId },
      select: { id: true, requiresAttachment: true, code: true },
    }),
    prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  const unpaidTypeIds = new Set(timeOffTypes.filter((t) => t.code === "UNPAID").map((t) => t.id));

  // 2. Compute Total Working Days in Month
  let totalWorkingDaysRaw = 0;
  for (let d = 1; d <= monthEnd.getUTCDate(); d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const day = date.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    if (day >= 1 && day <= company.workDaysPerWeek) {
      totalWorkingDaysRaw++;
    }
  }

  // Subtract holidays that fall on a working day
  let holidayCount = 0;
  for (const h of holidays) {
    const day = h.date.getUTCDay();
    if (day >= 1 && day <= company.workDaysPerWeek) {
      holidayCount++;
    }
  }
  const totalWorkingDays = Math.max(0, totalWorkingDaysRaw - holidayCount);

  // 3. Process each employee
  const drafts = [];
  const anomaliesList = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`.trim();
    const anomalies: any[] = [];

    // Find the applicable contract (latest effectiveFrom <= monthEnd)
    const contract = await prisma.contract.findFirst({
      where: {
        employeeId: emp.id,
        effectiveFrom: { lte: monthEnd },
        status: "RUNNING",
      },
      orderBy: { effectiveFrom: "desc" },
      include: { components: true },
    });

    if (!contract) {
      anomalies.push({
        type: "NO_CONTRACT",
        employeeId: emp.id,
        employeeName: name,
        message: "No active contract found for this month.",
      });
      drafts.push({
        employeeId: emp.id,
        employeeName: name,
        loginId: emp.user.loginId,
        totalWorkingDays,
        payableDays: "0",
        unpaidLeaveDays: "0",
        missingAttendanceDays: "0",
        lossOfPay: "0",
        grossEarnings: "0",
        totalDeductions: "0",
        netPay: "0",
        anomalies,
        status: "DRAFT",
      });
      continue; // skip engine run for this employee
    }

    // Attendance data
    const [unpaidLeaves, absentRecords] = await Promise.all([
      prisma.timeOffRequest.findMany({
        where: {
          employeeId: emp.id,
          status: "APPROVED",
          typeId: { in: Array.from(unpaidTypeIds) },
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          employeeId: emp.id,
          date: { gte: monthStart, lte: monthEnd },
          status: "ABSENT",
        },
      }),
    ]);

    // Very naive unpaid leave day count (just counting overlapping days in month)
    let unpaidLeaveDays = 0;
    for (const req of unpaidLeaves) {
      const s = req.startDate < monthStart ? monthStart : req.startDate;
      const e = req.endDate > monthEnd ? monthEnd : req.endDate;
      const days = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      unpaidLeaveDays += days;
    }

    const missingAttendanceDays = absentRecords;

    // Run Engine
    const result = computePayslip({
      monthlyWage: contract.monthlyWage.toString(),
      componentLines: contract.components.map((c) => ({
        code: c.code,
        label: c.name,
        category: c.category as ComponentCategory,
        computation: c.computation as ComponentComputation,
        amount: c.computedAmount as any,
      })),
      totalWorkingDays,
      unpaidLeaveDays,
      missingAttendanceDays,
      pfRateEmployee: company.pfRateEmployee.toString(),
      professionalTax: company.professionalTax.toString(),
    });

    if (result.payableDays.isZero()) {
      anomalies.push({
        type: "ZERO_PAYABLE_DAYS",
        employeeId: emp.id,
        employeeName: name,
        message: "Employee has 0 payable days.",
      });
    }
    if (result.netPay.lessThanOrEqualTo(0)) {
      anomalies.push({
        type: "NET_NOT_POSITIVE",
        employeeId: emp.id,
        employeeName: name,
        message: "Net pay is zero or negative.",
      });
    }
    const halfWage = contract.monthlyWage.toNumber() / 2;
    if (result.lossOfPay.toNumber() > halfWage) {
      anomalies.push({
        type: "HIGH_LOP",
        employeeId: emp.id,
        employeeName: name,
        message: "Loss of pay exceeds 50% of monthly wage.",
      });
    }

    // Upsert DRAFT Payslip
    await prisma.$transaction(async (tx) => {
      let payslip = await tx.payslip.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month,
            year,
          },
        },
      });

      // If it's already published, do NOT overwrite it!
      if (payslip && payslip.status === "PUBLISHED") {
        return;
      }

      if (payslip) {
        payslip = await tx.payslip.update({
          where: { id: payslip.id },
          data: {
            payableDays: result.payableDays.toString(),
            totalWorkingDays,
            unpaidLeaveDays: unpaidLeaveDays.toString(),
            missingAttendanceDays: missingAttendanceDays.toString(),
            perDayRate: result.perDayRate.toString(),
            grossEarnings: result.grossEarnings.toString(),
            totalDeductions: result.totalDeductions.toString(),
            netPay: result.netPay.toString(),
            lossOfPay: result.lossOfPay.toString(),
            status: "DRAFT",
          },
        });
        // Clear old lines
        await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
      } else {
        payslip = await tx.payslip.create({
          data: {
            companyId,
            employeeId: emp.id,
            month,
            year,
            payableDays: result.payableDays.toString(),
            totalWorkingDays,
            unpaidLeaveDays: unpaidLeaveDays.toString(),
            missingAttendanceDays: missingAttendanceDays.toString(),
            perDayRate: result.perDayRate.toString(),
            grossEarnings: result.grossEarnings.toString(),
            totalDeductions: result.totalDeductions.toString(),
            netPay: result.netPay.toString(),
            lossOfPay: result.lossOfPay.toString(),
            status: "DRAFT",
          },
        });
      }

      await tx.payslipLine.createMany({
        data: result.lines.map((l) => ({
          payslipId: payslip!.id,
          label: l.label,
          category: l.category,
          amount: l.amount.toString(),
        })),
      });
    });

    drafts.push({
      employeeId: emp.id,
      employeeName: name,
      loginId: emp.user.loginId,
      totalWorkingDays,
      payableDays: result.payableDays.toFixed(2),
      unpaidLeaveDays: unpaidLeaveDays.toString(),
      missingAttendanceDays: missingAttendanceDays.toString(),
      lossOfPay: result.lossOfPay.toFixed(2),
      grossEarnings: result.grossEarnings.toFixed(2),
      totalDeductions: result.totalDeductions.toFixed(2),
      netPay: result.netPay.toFixed(2),
      anomalies,
      status: "DRAFT",
    });

    anomaliesList.push(...anomalies);
  }

  await writeAudit({
    companyId,
    actorId,
    action: "PAYROLL_RUN",
    entity: "Company",
    entityId: companyId,
    after: { month, year },
  });

  return { drafts, anomalies: anomaliesList };
}

// ---------------------------------------------------------------------------
// Publish Payroll
// ---------------------------------------------------------------------------

export async function publishPayroll(
  companyId: string,
  actorId: string,
  month: number,
  year: number,
  force: boolean,
) {
  // First, verify no anomalies if force is false
  if (!force) {
    const { anomalies } = await runPayroll(companyId, actorId, month, year);
    if (anomalies.length > 0) {
      throw new ApiError(
        400,
        "UNRESOLVED_ANOMALIES",
        "Cannot publish payroll with unresolved anomalies unless forced",
      );
    }
  }

  const drafts = await prisma.payslip.findMany({
    where: { companyId, month, year, status: "DRAFT" },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      employee: {
        include: {
          user: true,
          privateInfo: true,
        },
      },
    },
  });

  if (drafts.length === 0) {
    return { count: 0 };
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  let publishCount = 0;

  for (const draft of drafts) {
    // Generate PDF
    const pdfUrl = await generatePayslipPdf(draft.id, {
      companyName: company.name,
      employeeName: `${draft.employee.firstName} ${draft.employee.lastName}`,
      employeeCode: draft.employee.privateInfo?.employeeCode ?? null,
      month,
      year,
      payableDays: draft.payableDays.toString(),
      totalWorkingDays: draft.totalWorkingDays.toNumber(),
      lossOfPay: draft.lossOfPay.toString(),
      grossEarnings: draft.grossEarnings.toString(),
      totalDeductions: draft.totalDeductions.toString(),
      netPay: draft.netPay.toString(),
      lines: draft.lines.map((l) => ({
        label: l.label,
        amount: l.amount.toString(),
        category: l.category,
      })),
    });

    // Update to PUBLISHED
    await prisma.payslip.update({
      where: { id: draft.id },
      data: {
        status: "PUBLISHED",
        pdfUrl,
        publishedAt: new Date(),
      },
    });

    // Notify employee (email)
    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    await sendPayslipReadyEmail(draft.employee.user.email, {
      name: draft.employee.firstName,
      month: new Date(year, month - 1, 1).toLocaleString("default", { month: "long" }),
      year,
      appUrl: `${appUrl}/payroll`,
    });

    publishCount++;
  }

  await writeAudit({
    companyId,
    actorId,
    action: "PAYROLL_PUBLISHED",
    entity: "Company",
    entityId: companyId,
    after: { month, year, publishCount },
  });

  return { count: publishCount };
}

// ---------------------------------------------------------------------------
// Employee Payslip View
// ---------------------------------------------------------------------------

export async function getPayslips(employeeId: string, companyId: string) {
  const payslips = await prisma.payslip.findMany({
    where: { employeeId, companyId, status: "PUBLISHED" },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      month: true,
      year: true,
      status: true,
      netPay: true,
      pdfUrl: true,
    },
  });

  return payslips.map((p) => ({
    ...p,
    netPay: p.netPay.toString(),
  }));
}
