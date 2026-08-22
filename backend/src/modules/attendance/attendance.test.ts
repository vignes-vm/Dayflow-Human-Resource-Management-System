import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "@/index.js";
import { prisma } from "@/lib/prisma.js";
import { TEST_PASSWORD } from "@/test/helpers.js";
import { closeAttendanceDay } from "@/modules/attendance/attendance.service.js";

async function createSignedInEmployee(role: "ADMIN" | "HR" | "EMPLOYEE" = "EMPLOYEE") {
  const suffix = randomUUID().slice(0, 8);
  const company = await prisma.company.create({
    data: { name: `Test Co ${suffix}`, code: "TC" },
  });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      loginId: `TCJODO2026${suffix.slice(0, 4).toUpperCase()}`,
      email: `user-${suffix}@example.com`,
      passwordHash,
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });
  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      companyId: company.id,
      firstName: "Test",
      lastName: "Employee",
      joinedOn: new Date(),
      joiningYear: new Date().getFullYear(),
      joiningSerial: 1,
    },
  });

  const agent = request.agent(app);
  const loginRes = await agent
    .post("/api/v1/auth/login")
    .send({ identifier: user.email, password: TEST_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(`test login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return { agent, user, company, employee };
}

describe("POST /attendance/check-in and /check-out", () => {
  it("checks in, opens a session, and reflects in /attendance/me", async () => {
    const { agent } = await createSignedInEmployee();

    const checkInRes = await agent.post("/api/v1/attendance/check-in");
    expect(checkInRes.status).toBe(201);

    const meRes = await agent.get("/api/v1/attendance/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.data).toHaveLength(1);
    expect(meRes.body.data[0].sessions).toHaveLength(1);
    expect(meRes.body.data[0].sessions[0].outAt).toBeNull();
  });

  it("rejects a double check-in", async () => {
    const { agent } = await createSignedInEmployee();
    await agent.post("/api/v1/attendance/check-in");
    const second = await agent.post("/api/v1/attendance/check-in");
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("ALREADY_CHECKED_IN");
  });

  it("rejects a check-out without a check-in", async () => {
    const { agent } = await createSignedInEmployee();
    const res = await agent.post("/api/v1/attendance/check-out");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NOT_CHECKED_IN");
  });

  it("computes work minutes on check-out", async () => {
    const { agent, employee } = await createSignedInEmployee();
    await agent.post("/api/v1/attendance/check-in");

    // Backdate the session's inAt so check-out produces a non-trivial duration.
    await prisma.attendanceSession.updateMany({
      where: { attendanceRecord: { employeeId: employee.id } },
      data: { inAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const checkOutRes = await agent.post("/api/v1/attendance/check-out");
    expect(checkOutRes.status).toBe(200);

    const record = await prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id },
    });
    expect(record!.workMinutes).toBeGreaterThanOrEqual(59);
  });
});

describe("GET /attendance/day", () => {
  it("lists every employee for the company on a given date", async () => {
    const { agent } = await createSignedInEmployee("ADMIN");
    const today = new Date().toISOString().slice(0, 10);

    const res = await agent.get(`/api/v1/attendance/day?date=${today}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("blocks a non-admin", async () => {
    const { agent } = await createSignedInEmployee("EMPLOYEE");
    const today = new Date().toISOString().slice(0, 10);
    const res = await agent.get(`/api/v1/attendance/day?date=${today}`);
    expect(res.status).toBe(403);
  });
});

describe("closeAttendanceDay", () => {
  it("is idempotent — running twice does not change the record", async () => {
    const { company, employee } = await createSignedInEmployee();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await closeAttendanceDay(company.id, today);
    const first = await prisma.attendanceRecord.findFirst({ where: { employeeId: employee.id } });

    await closeAttendanceDay(company.id, today);
    const second = await prisma.attendanceRecord.findFirst({ where: { employeeId: employee.id } });

    expect(second!.status).toBe(first!.status);
    expect(second!.workMinutes).toBe(first!.workMinutes);
  });
});
