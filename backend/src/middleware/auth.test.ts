import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret";
});

function mockRes() {
  return {} as Response;
}

describe("requireAuth", () => {
  it("rejects when there is no access_token cookie", async () => {
    const { requireAuth } = await import("@/middleware/auth.js");
    const req = { cookies: {} } as unknown as Request;
    const next = vi.fn();
    requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHENTICATED");
  });

  it("sets req.user for a valid access token", async () => {
    const { requireAuth, signAccessToken } = await import("@/middleware/auth.js");
    const token = signAccessToken({
      sub: "user_1",
      companyId: "company_1",
      role: "ADMIN",
      employeeId: "emp_1",
      mustChangePassword: false,
    });
    const req = { cookies: { access_token: token } } as unknown as Request;
    const next = vi.fn();
    requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user?.sub).toBe("user_1");
    expect(req.user?.role).toBe("ADMIN");
  });

  it("rejects a garbage token", async () => {
    const { requireAuth } = await import("@/middleware/auth.js");
    const req = { cookies: { access_token: "not-a-real-jwt" } } as unknown as Request;
    const next = vi.fn();
    requireAuth(req, mockRes(), next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(401);
  });
});

describe("requirePasswordChanged", () => {
  it("blocks a user whose mustChangePassword flag is set", async () => {
    const { requirePasswordChanged } = await import("@/middleware/auth.js");
    const req = { user: { mustChangePassword: true } } as unknown as Request;
    const next = vi.fn();
    requirePasswordChanged(req, mockRes(), next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(403);
    expect(err.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("passes a user who has already changed their password", async () => {
    const { requirePasswordChanged } = await import("@/middleware/auth.js");
    const req = { user: { mustChangePassword: false } } as unknown as Request;
    const next = vi.fn();
    requirePasswordChanged(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("requireRole", () => {
  it("allows a matching role", async () => {
    const { requireRole } = await import("@/middleware/auth.js");
    const req = { user: { role: "ADMIN" } } as unknown as Request;
    const next = vi.fn();
    requireRole("ADMIN", "HR")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks a non-matching role", async () => {
    const { requireRole } = await import("@/middleware/auth.js");
    const req = { user: { role: "EMPLOYEE" } } as unknown as Request;
    const next = vi.fn();
    requireRole("ADMIN", "HR")(req, mockRes(), next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(403);
  });
});

describe("assertSelfOrAdmin", () => {
  it("allows an admin to access any employee", async () => {
    const { assertSelfOrAdmin } = await import("@/middleware/auth.js");
    const req = { user: { role: "ADMIN", employeeId: "emp_1" } } as unknown as Request;
    const next = vi.fn();
    assertSelfOrAdmin(() => "emp_999")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows an employee to access their own record", async () => {
    const { assertSelfOrAdmin } = await import("@/middleware/auth.js");
    const req = { user: { role: "EMPLOYEE", employeeId: "emp_1" } } as unknown as Request;
    const next = vi.fn();
    assertSelfOrAdmin(() => "emp_1")(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks an employee from accessing someone else's record", async () => {
    const { assertSelfOrAdmin } = await import("@/middleware/auth.js");
    const req = { user: { role: "EMPLOYEE", employeeId: "emp_1" } } as unknown as Request;
    const next = vi.fn();
    assertSelfOrAdmin(() => "emp_999")(req, mockRes(), next);
    const err = next.mock.calls[0]![0];
    expect(err.status).toBe(403);
  });

  it("allows HR through only when allowHr is set", async () => {
    const { assertSelfOrAdmin } = await import("@/middleware/auth.js");
    const req = { user: { role: "HR", employeeId: "emp_1" } } as unknown as Request;
    const blockedNext = vi.fn();
    assertSelfOrAdmin(() => "emp_999")(req, mockRes(), blockedNext);
    expect(blockedNext.mock.calls[0]![0].status).toBe(403);

    const allowedNext = vi.fn();
    assertSelfOrAdmin(() => "emp_999", { allowHr: true })(req, mockRes(), allowedNext);
    expect(allowedNext).toHaveBeenCalledWith();
  });
});
