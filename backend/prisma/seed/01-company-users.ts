// M1 — creates the demo company, the Admin and the HR Officer.
// See docs/Dayflow-Blueprint-v2.md §14.1 and docs/Dayflow-Team-Plan.md §3.6.
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";

import { buildLoginId, deriveCompanyCode } from "../../src/engines/loginId.js";
import { allocateSerial } from "../../src/lib/loginIdCounter.js";
import { prisma } from "../../src/lib/prisma.js";

const DEMO_PASSWORD = "Dayflow@2026";
const JOINING_YEAR = 2023;

const PEOPLE = [
  {
    firstName: "Aditya",
    lastName: "Sharma",
    email: "admin@odooindia.example",
    role: Role.ADMIN,
    jobTitle: "Administrator",
  },
  {
    firstName: "Neha",
    lastName: "Kapoor",
    email: "hr@odooindia.example",
    role: Role.HR,
    jobTitle: "HR Officer",
  },
] as const;

export async function seed(): Promise<void> {
  const existing = await prisma.company.findUnique({ where: { name: "Odoo India" } });
  if (existing) {
    console.log("  01-company-users: Odoo India already exists — skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: "Odoo India", code: deriveCompanyCode("Odoo India") },
    });

    for (const person of PEOPLE) {
      const serial = await allocateSerial(tx, company.id, JOINING_YEAR);
      const loginId = buildLoginId({
        companyCode: company.code,
        firstName: person.firstName,
        lastName: person.lastName,
        joiningYear: JOINING_YEAR,
        serial,
        serialWidth: company.serialWidth,
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          loginId,
          email: person.email,
          passwordHash,
          role: person.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
        },
      });

      await tx.employee.create({
        data: {
          userId: user.id,
          companyId: company.id,
          firstName: person.firstName,
          lastName: person.lastName,
          jobTitle: person.jobTitle,
          joinedOn: new Date(`${JOINING_YEAR}-01-15`),
          joiningYear: JOINING_YEAR,
          joiningSerial: serial,
        },
      });

      console.log(`  01-company-users: ${person.role} ${loginId} (${person.email})`);
    }

    await tx.timeOffType.createMany({
      data: [
        {
          companyId: company.id,
          name: "Paid Time Off",
          code: "PAID",
          isPaid: true,
          defaultAllocationDays: 24,
        },
        {
          companyId: company.id,
          name: "Sick Leave",
          code: "SICK",
          isPaid: true,
          requiresAttachment: true,
          defaultAllocationDays: 9,
        },
        {
          companyId: company.id,
          name: "Unpaid Leave",
          code: "UNPAID",
          isPaid: false,
          defaultAllocationDays: 0,
        },
      ],
    });
  });

  console.log(`  01-company-users: done — all demo passwords are "${DEMO_PASSWORD}"`);
}
