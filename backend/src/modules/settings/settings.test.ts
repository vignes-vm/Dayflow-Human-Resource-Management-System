import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma.js";
import { createSignedInUser } from "@/test/helpers.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("holidays", () => {
  it("lets an admin create, list and delete a holiday", async () => {
    const { agent } = await createSignedInUser("ADMIN");
    const year = new Date().getFullYear();

    const create = await agent
      .post("/api/v1/settings/holidays")
      .send({ date: `${year}-10-13`, name: "Dussehra" });
    expect(create.status).toBe(201);

    const list = await agent.get(`/api/v1/settings/holidays?year=${year}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((h: { name: string }) => h.name === "Dussehra")).toBe(true);

    const del = await agent.delete(`/api/v1/settings/holidays/${create.body.id}`);
    expect(del.status).toBe(200);

    const listAfter = await agent.get(`/api/v1/settings/holidays?year=${year}`);
    expect(listAfter.body.items.some((h: { id: string }) => h.id === create.body.id)).toBe(false);
  });

  it("blocks a non-admin from creating a holiday", async () => {
    const { agent } = await createSignedInUser("HR");
    const res = await agent
      .post("/api/v1/settings/holidays")
      .send({ date: "2026-01-26", name: "Republic Day" });
    expect(res.status).toBe(403);
  });

  it("bulk-imports without duplicating on a second run", async () => {
    const { agent } = await createSignedInUser("ADMIN");
    const holidays = [
      { date: "2026-01-26", name: "Republic Day" },
      { date: "2026-08-15", name: "Independence Day" },
    ];

    const first = await agent.post("/api/v1/settings/holidays/bulk-import").send({ holidays });
    expect(first.status).toBe(201);
    expect(first.body.imported).toBe(2);

    const second = await agent.post("/api/v1/settings/holidays/bulk-import").send({ holidays });
    expect(second.status).toBe(201);
    expect(second.body.imported).toBe(0);
  });

  it("scopes holidays to the caller's own company", async () => {
    const a = await createSignedInUser("ADMIN");
    const b = await createSignedInUser("ADMIN");
    await a.agent.post("/api/v1/settings/holidays").send({ date: "2026-12-25", name: "Christmas" });

    const bList = await b.agent.get("/api/v1/settings/holidays?year=2026");
    expect(bList.body.items.some((h: { name: string }) => h.name === "Christmas")).toBe(false);
  });
});

describe("GET /settings/next-login-id-preview", () => {
  it("previews the format without allocating a real serial", async () => {
    const { agent, company } = await createSignedInUser("ADMIN");
    const res = await agent.get("/api/v1/settings/next-login-id-preview");
    expect(res.status).toBe(200);
    expect(res.body.preview.startsWith(company.code)).toBe(true);

    const counter = await prisma.loginIdCounter.findFirst({ where: { companyId: company.id } });
    expect(counter).toBeNull();
  });
});
