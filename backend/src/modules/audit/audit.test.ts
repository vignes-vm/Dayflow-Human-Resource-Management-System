import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma.js";
import { createSignedInUser } from "@/test/helpers.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /audit", () => {
  it("lists audit entries scoped to the caller's company, most recent first", async () => {
    const { agent, company } = await createSignedInUser("ADMIN");
    await agent.patch("/api/v1/company").send({ professionalTax: 300 });
    await agent
      .post("/api/v1/settings/holidays")
      .send({ date: "2026-11-01", name: "Custom Holiday" });

    const res = await agent.get("/api/v1/audit");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.items.every((i: { companyId: string }) => i.companyId === company.id)).toBe(
      true,
    );

    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain("COMPANY_SETTINGS_UPDATED");
    expect(actions).toContain("HOLIDAY_CREATED");
  });

  it("filters by entity", async () => {
    const { agent } = await createSignedInUser("ADMIN");
    await agent.post("/api/v1/settings/holidays").send({ date: "2026-11-02", name: "Filter Test" });
    await agent.patch("/api/v1/company").send({ professionalTax: 310 });

    const res = await agent.get("/api/v1/audit?entity=Holiday");
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: { entity: string }) => i.entity === "Holiday")).toBe(true);
  });

  it("blocks a non-admin", async () => {
    const { agent } = await createSignedInUser("EMPLOYEE");
    const res = await agent.get("/api/v1/audit");
    expect(res.status).toBe(403);
  });

  it("never leaks another company's audit entries", async () => {
    const a = await createSignedInUser("ADMIN");
    const b = await createSignedInUser("ADMIN");
    await a.agent.patch("/api/v1/company").send({ professionalTax: 320 });

    const res = await b.agent.get("/api/v1/audit");
    expect(res.body.items.every((i: { companyId: string }) => i.companyId === b.company.id)).toBe(
      true,
    );
  });
});
