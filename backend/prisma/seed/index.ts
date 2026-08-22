// M1 — calls each domain owner's numbered seed file in order. No shared
// seed file exists; each owner writes their own. See docs/Dayflow-Team-Plan.md §3.6.
// Idempotent: every seed file checks for its own data before writing.
import "dotenv/config";

import { seed as seedCompanyUsers } from "./01-company-users.js";
import { seed as seedEmployeesContracts } from "./02-employees-contracts.js";
import { seed as seedAttendance } from "./03-attendance.js";
import { seed as seedTimeoff } from "./04-timeoff.js";
import { seed as seedPayslipsAudit } from "./05-payslips-audit.js";
import { prisma } from "../../src/lib/prisma.js";

async function main(): Promise<void> {
  console.log("Seeding Dayflow...");
  await seedCompanyUsers();
  await seedEmployeesContracts();
  await seedAttendance();
  await seedTimeoff();
  await seedPayslipsAudit();
  console.log("Seed complete.");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
