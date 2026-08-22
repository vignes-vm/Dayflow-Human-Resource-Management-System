import { prisma } from "../../src/lib/prisma.js";
import { runPayroll, publishPayroll } from "../../src/modules/payroll/payroll.service.js";

export async function seed(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { name: "Odoo India" } });
  if (!company) {
    console.log("  05-payslips-audit: Company not found. Skip.");
    return;
  }

  const existingPayslips = await prisma.payslip.findFirst({ where: { companyId: company.id } });
  if (existingPayslips) {
    console.log("  05-payslips-audit: Payslips already exist — skipping");
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
  });

  if (!admin) {
    console.log("  05-payslips-audit: Admin not found. Skip.");
    return;
  }

  // Get current date
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // We want to run payroll for the TWO prior months.
  // Example: if now is Aug 2026, we run Jun 2026 and Jul 2026.
  const monthsToRun = [];
  for (let i = 2; i >= 1; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    monthsToRun.push({ month: m, year: y });
  }

  for (const period of monthsToRun) {
    console.log(`  05-payslips-audit: Running payroll for ${period.month}/${period.year}...`);
    // 1. Run (Creates DRAFTs)
    await runPayroll(company.id, admin.id, period.month, period.year);

    // 2. Publish (Creates PDFs, emails, sets PUBLISHED)
    await publishPayroll(company.id, admin.id, period.month, period.year, true);
  }

  // Generate 30 mock audit entries
  const entities = ["Employee", "Contract", "Settings", "Profile", "Document"];
  const actions = ["CREATED", "UPDATED", "DELETED"];

  const auditData = [];
  for (let i = 0; i < 30; i++) {
    const e = entities[Math.floor(Math.random() * entities.length)];
    const a = actions[Math.floor(Math.random() * actions.length)];
    auditData.push({
      companyId: company.id,
      actorId: admin.id,
      action: `${e.toUpperCase()}_${a}`,
      entity: e,
      entityId: `mock-id-${i}`,
      before: a === "UPDATED" ? { status: "OLD" } : null,
      after: a !== "DELETED" ? { status: "NEW" } : null,
      createdAt: new Date(now.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Random time in last 30 days
    });
  }

  await prisma.auditLog.createMany({ data: auditData });

  // Generate 10 mock notifications for admin
  const notifData = [];
  for (let i = 0; i < 10; i++) {
    notifData.push({
      companyId: company.id,
      userId: admin.id,
      title: "System Update",
      body: `Notification generated for testing purposes #${i + 1}`,
      link: "/settings",
      isRead: i < 5, // half read
      createdAt: new Date(now.getTime() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.notification.createMany({ data: notifData });

  console.log(
    `  05-payslips-audit: Seeded 2 months of payslips (published), 30 audit logs, and 10 notifications.`,
  );
}
