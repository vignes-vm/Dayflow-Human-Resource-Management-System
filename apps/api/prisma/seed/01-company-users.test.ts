import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/lib/prisma.js";
import { seed } from "./01-company-users.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("01-company-users seed", () => {
  it("is idempotent — running twice does not duplicate the company or users", async () => {
    await seed();
    const companyAfterFirst = await prisma.company.findUniqueOrThrow({
      where: { name: "Odoo India" },
    });
    const usersAfterFirst = await prisma.user.count({ where: { companyId: companyAfterFirst.id } });

    await seed();
    const companies = await prisma.company.count({ where: { name: "Odoo India" } });
    const usersAfterSecond = await prisma.user.count({
      where: { companyId: companyAfterFirst.id },
    });

    expect(companies).toBe(1);
    expect(usersAfterSecond).toBe(usersAfterFirst);
  });

  it("generates the admin and HR Login IDs in the documented format", async () => {
    await seed();
    const company = await prisma.company.findUniqueOrThrow({ where: { name: "Odoo India" } });
    const users = await prisma.user.findMany({ where: { companyId: company.id } });

    expect(users).toHaveLength(2);
    for (const user of users) {
      expect(user.loginId).toMatch(/^OD[A-Z]{4}20230001$|^OD[A-Z]{4}20230002$/);
      expect(user.mustChangePassword).toBe(false);
    }
  });
});
