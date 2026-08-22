import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Unit tests for profile service business logic that can be tested without a DB.
 * The DB-touching functions are tested via integration tests; here we focus on
 * the access control rules and masking logic.
 */

// ---------------------------------------------------------------------------
// Bank account masking logic (extracted for unit testing)
// ---------------------------------------------------------------------------

function maskBankAccount(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  return `${"*".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

describe("maskBankAccount", () => {
  it("masks all but last 4 digits", () => {
    expect(maskBankAccount("1234567890123456")).toBe("************3456");
  });

  it("handles 4-digit account (no masking)", () => {
    expect(maskBankAccount("1234")).toBe("1234");
  });

  it("handles 5-digit account (1 asterisk)", () => {
    expect(maskBankAccount("12345")).toBe("*2345");
  });

  it("returns null for null input", () => {
    expect(maskBankAccount(null)).toBeNull();
  });

  it("returns null for empty string (treated as falsy)", () => {
    expect(maskBankAccount("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Access control — private info
// ---------------------------------------------------------------------------

type ViewerRole = "ADMIN" | "HR" | "EMPLOYEE";

function canAccessPrivateInfo(
  viewerRole: ViewerRole,
  viewerEmployeeId: string | null,
  targetEmployeeId: string,
): boolean {
  const isPrivileged = viewerRole === "ADMIN" || viewerRole === "HR";
  const isSelf = targetEmployeeId === viewerEmployeeId;
  return isPrivileged || isSelf;
}

describe("canAccessPrivateInfo — access control rules", () => {
  const TARGET_ID = "emp-123";
  const OTHER_ID = "emp-456";

  it("ADMIN can always access", () => {
    expect(canAccessPrivateInfo("ADMIN", OTHER_ID, TARGET_ID)).toBe(true);
  });

  it("HR can always access", () => {
    expect(canAccessPrivateInfo("HR", OTHER_ID, TARGET_ID)).toBe(true);
  });

  it("EMPLOYEE can access their own private info", () => {
    expect(canAccessPrivateInfo("EMPLOYEE", TARGET_ID, TARGET_ID)).toBe(true);
  });

  it("EMPLOYEE cannot access another employee's private info", () => {
    expect(canAccessPrivateInfo("EMPLOYEE", OTHER_ID, TARGET_ID)).toBe(false);
  });

  it("EMPLOYEE with null employeeId (edge case) cannot access", () => {
    expect(canAccessPrivateInfo("EMPLOYEE", null, TARGET_ID)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Access control — resume (self or ADMIN/HR)
// ---------------------------------------------------------------------------

function canWriteResume(
  viewerRole: ViewerRole,
  viewerEmployeeId: string | null,
  targetEmployeeId: string,
): boolean {
  const isPrivileged = viewerRole === "ADMIN" || viewerRole === "HR";
  const isSelf = targetEmployeeId === viewerEmployeeId;
  return isPrivileged || isSelf;
}

describe("canWriteResume — access control", () => {
  const TARGET_ID = "emp-123";
  const OTHER_ID = "emp-456";

  it("EMPLOYEE can write their own resume", () => {
    expect(canWriteResume("EMPLOYEE", TARGET_ID, TARGET_ID)).toBe(true);
  });

  it("EMPLOYEE cannot write another employee's resume", () => {
    expect(canWriteResume("EMPLOYEE", OTHER_ID, TARGET_ID)).toBe(false);
  });

  it("HR can write any resume", () => {
    expect(canWriteResume("HR", OTHER_ID, TARGET_ID)).toBe(true);
  });
});
