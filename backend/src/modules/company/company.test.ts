import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma.js";
import { createSignedInUser } from "@/test/helpers.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /company", () => {
  it("returns the signed-in user's company", async () => {
    const { agent, company } = await createSignedInUser();
    const res = await agent.get("/api/v1/company");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(company.id);
  });
});

describe("PATCH /company", () => {
  it("lets an admin update settings and writes an audit entry", async () => {
    const { agent, company } = await createSignedInUser("ADMIN");
    const res = await agent
      .patch("/api/v1/company")
      .send({ professionalTax: 250, breakMinutes: 45 });
    expect(res.status).toBe(200);
    expect(Number(res.body.professionalTax)).toBe(250);
    expect(res.body.breakMinutes).toBe(45);

    const audit = await prisma.auditLog.findFirst({
      where: { companyId: company.id, action: "COMPANY_SETTINGS_UPDATED" },
    });
    expect(audit).not.toBeNull();
  });

  it("blocks a non-admin", async () => {
    const { agent } = await createSignedInUser("EMPLOYEE");
    const res = await agent.patch("/api/v1/company").send({ professionalTax: 999 });
    expect(res.status).toBe(403);
  });

  it("rejects an unknown field", async () => {
    const { agent } = await createSignedInUser("ADMIN");
    const res = await agent.patch("/api/v1/company").send({ notAField: true });
    expect(res.status).toBe(400);
  });
});
