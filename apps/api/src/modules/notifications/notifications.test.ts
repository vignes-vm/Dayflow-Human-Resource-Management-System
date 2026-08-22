import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

import { app } from "@/index.js";
import { prisma } from "@/lib/prisma.js";
import { notify } from "@/lib/notify.js";

async function createSignedInUser() {
  const suffix = randomUUID().slice(0, 8);
  const company = await prisma.company.create({
    data: { name: `Notif Co ${suffix}`, code: "NC" },
  });
  const passwordHash = await bcrypt.hash("Str0ngPass!", 4);
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      loginId: `NCJODO2026${suffix.slice(0, 4).toUpperCase()}`,
      email: `notif-${suffix}@example.com`,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const agent = request.agent(app);
  const loginRes = await agent
    .post("/api/v1/auth/login")
    .send({ identifier: user.email, password: "Str0ngPass!" });
  expect(loginRes.status).toBe(200);

  return { agent, user, company };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("notify()", () => {
  it("writes a Notification row per recipient", async () => {
    const { user, company } = await createSignedInUser();

    await notify({
      companyId: company.id,
      userIds: [user.id],
      type: "TEST_EVENT",
      title: "Something happened",
    });

    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Something happened");
  });
});

describe("GET /notifications", () => {
  it("lists notifications for the signed-in user with an unread count", async () => {
    const { agent, user, company } = await createSignedInUser();
    await notify({ companyId: company.id, userIds: [user.id], type: "A", title: "First" });
    await notify({ companyId: company.id, userIds: [user.id], type: "B", title: "Second" });

    const res = await agent.get("/api/v1/notifications");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
  });
});

describe("POST /notifications/:id/read", () => {
  it("marks a notification read and decrements the unread count", async () => {
    const { agent, user, company } = await createSignedInUser();
    await notify({ companyId: company.id, userIds: [user.id], type: "A", title: "First" });
    const list = await agent.get("/api/v1/notifications");
    const id = list.body.items[0].id;

    const readRes = await agent.post(`/api/v1/notifications/${id}/read`);
    expect(readRes.status).toBe(200);

    const after = await agent.get("/api/v1/notifications");
    expect(after.body.unreadCount).toBe(0);
  });

  it("404s when marking someone else's notification as read", async () => {
    const owner = await createSignedInUser();
    const other = await createSignedInUser();
    await notify({
      companyId: owner.company.id,
      userIds: [owner.user.id],
      type: "A",
      title: "Private",
    });
    const list = await owner.agent.get("/api/v1/notifications");
    const id = list.body.items[0].id;

    const res = await other.agent.post(`/api/v1/notifications/${id}/read`);
    expect(res.status).toBe(404);
  });
});

describe("POST /notifications/read-all", () => {
  it("marks every unread notification as read", async () => {
    const { agent, user, company } = await createSignedInUser();
    await notify({ companyId: company.id, userIds: [user.id], type: "A", title: "First" });
    await notify({ companyId: company.id, userIds: [user.id], type: "B", title: "Second" });

    const res = await agent.post("/api/v1/notifications/read-all");
    expect(res.status).toBe(200);

    const after = await agent.get("/api/v1/notifications");
    expect(after.body.unreadCount).toBe(0);
  });
});
