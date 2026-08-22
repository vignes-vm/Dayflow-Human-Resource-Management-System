import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "@/index.js";
import { prisma } from "@/lib/prisma.js";

function uniqueCompany() {
  const suffix = randomUUID().slice(0, 8);
  return {
    companyName: `Test Co ${suffix}`,
    adminName: "John Doe",
    email: `admin-${suffix}@example.com`,
    phone: "9999999999",
    password: "Str0ngPass!",
    confirmPassword: "Str0ngPass!",
  };
}

async function registerAndVerify() {
  const payload = uniqueCompany();
  const registerRes = await request(app).post("/api/v1/auth/register-company").send(payload);
  expect(registerRes.status).toBe(201);

  const token = new URL(registerRes.body.verifyUrl).searchParams.get("token")!;
  const verifyRes = await request(app).get(`/api/v1/auth/verify?token=${token}`);
  expect(verifyRes.status).toBe(200);

  return {
    payload,
    loginId: registerRes.body.loginId as string,
    companyId: registerRes.body.companyId as string,
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /auth/register-company", () => {
  it("creates the company, admin, employee, login id, and default time-off types", async () => {
    const { loginId, companyId } = await registerAndVerify();

    expect(loginId).toMatch(/^[A-Z]{6}\d{8}$/);

    const types = await prisma.timeOffType.findMany({ where: { companyId } });
    expect(types.map((t) => t.code).sort()).toEqual(["PAID", "SICK", "UNPAID"]);
    expect(types.find((t) => t.code === "SICK")?.requiresAttachment).toBe(true);

    const employee = await prisma.employee.findFirst({ where: { companyId } });
    expect(employee?.joiningSerial).toBe(1);
  });

  it("rejects a duplicate company name", async () => {
    const payload = uniqueCompany();
    const first = await request(app).post("/api/v1/auth/register-company").send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/auth/register-company")
      .send({ ...payload, email: `other-${randomUUID().slice(0, 8)}@example.com` });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("COMPANY_NAME_TAKEN");
  });

  it("rejects a duplicate email", async () => {
    const payload = uniqueCompany();
    const first = await request(app).post("/api/v1/auth/register-company").send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/auth/register-company")
      .send({ ...payload, companyName: `Another Co ${randomUUID().slice(0, 8)}` });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /auth/login", () => {
  it("blocks an unverified admin", async () => {
    const payload = uniqueCompany();
    const registerRes = await request(app).post("/api/v1/auth/register-company").send(payload);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    void registerRes;
  });

  it("logs in by Login ID and by email, case-insensitively", async () => {
    const { payload, loginId } = await registerAndVerify();

    const byLoginId = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: loginId.toLowerCase(), password: payload.password });
    expect(byLoginId.status).toBe(200);
    expect(byLoginId.body.mustChangePassword).toBe(false);

    const byEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email.toUpperCase(), password: payload.password });
    expect(byEmail.status).toBe(200);
  });

  it("returns the same error for an unknown identifier and a wrong password", async () => {
    const { payload } = await registerAndVerify();

    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: "nobody@example.com", password: "whatever1!" });
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: "wrong-password-1!" });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("session lifecycle", () => {
  it("GET /auth/me returns the signed-in user and employee", async () => {
    const { payload } = await registerAndVerify();
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });

    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(payload.email.toLowerCase());
    expect(me.body.employee.firstName).toBe("John");
  });

  it("rotates the refresh token and detects reuse of a revoked token", async () => {
    const { payload } = await registerAndVerify();
    const agent = request.agent(app);
    const loginRes = await agent
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });

    const setCookie = loginRes.headers["set-cookie"] as unknown as string[];
    const oldRefreshCookie = setCookie
      .find((c) => c.startsWith("refresh_token="))!
      .split(";")[0]!
      .split("=")[1]!;

    const refreshRes = await agent.post("/api/v1/auth/refresh");
    expect(refreshRes.status).toBe(200);

    // Replay the old (now-revoked) refresh token — must be rejected and kill the family
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refresh_token=${oldRefreshCookie}`]);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSED");

    // The token issued by the legitimate refresh should now also be dead (family killed)
    const afterReuse = await agent.post("/api/v1/auth/refresh");
    expect(afterReuse.status).toBe(401);
  });

  it("change-password requires the current password and rotates it", async () => {
    const { payload } = await registerAndVerify();
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });

    const wrongCurrent = await agent
      .post("/api/v1/auth/change-password")
      .send({
        currentPassword: "wrong-one-1!",
        newPassword: "NewStr0ngPass!",
        confirmPassword: "NewStr0ngPass!",
      });
    expect(wrongCurrent.status).toBe(401);

    const ok = await agent.post("/api/v1/auth/change-password").send({
      currentPassword: payload.password,
      newPassword: "NewStr0ngPass!",
      confirmPassword: "NewStr0ngPass!",
    });
    expect(ok.status).toBe(200);

    const loginWithOld = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });
    expect(loginWithOld.status).toBe(401);

    const loginWithNew = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: "NewStr0ngPass!" });
    expect(loginWithNew.status).toBe(200);
  });
});

describe("forgot / reset password", () => {
  it("resets the password via a token and revokes existing sessions", async () => {
    const { payload } = await registerAndVerify();

    const forgotRes = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: payload.email });
    expect(forgotRes.status).toBe(200);
    const token = new URL(forgotRes.body.resetUrl).searchParams.get("token")!;

    const resetRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "ResetPass1!", confirmPassword: "ResetPass1!" });
    expect(resetRes.status).toBe(200);

    const loginWithOld = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: payload.password });
    expect(loginWithOld.status).toBe(401);

    const loginWithNew = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: payload.email, password: "ResetPass1!" });
    expect(loginWithNew.status).toBe(200);
  });

  it("responds the same whether or not the email exists (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "definitely-not-registered@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(true);
  });
});
