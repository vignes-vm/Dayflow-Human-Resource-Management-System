import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import type { RegisterCompanyInput } from "@dayflow/shared";

import { buildLoginId, deriveCompanyCode } from "@/engines/loginId.js";
import { writeAudit } from "@/lib/audit.js";
import { allocateSerial } from "@/lib/loginIdCounter.js";
import { parseDurationMs } from "@/lib/duration.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mailer.js";
import { prisma } from "@/lib/prisma.js";
import { generateOpaqueToken, hashToken } from "@/lib/tokens.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { signAccessToken } from "@/middleware/auth.js";

const BCRYPT_ROUNDS = 12;

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const [firstName = "", ...rest] = parts;
  return { firstName, lastName: rest.join(" ") };
}

export interface RegisterCompanyResult {
  companyId: string;
  userId: string;
  loginId: string;
  email: string;
  verifyUrl: string;
  emailPreviewUrl?: string;
}

export async function registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
  const email = input.email.toLowerCase();

  const [existingCompany, existingUser] = await Promise.all([
    prisma.company.findUnique({ where: { name: input.companyName } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (existingCompany) {
    throw new ApiError(
      409,
      "COMPANY_NAME_TAKEN",
      "A company with this name already exists",
      "companyName",
    );
  }
  if (existingUser) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists", "email");
  }

  const { firstName, lastName } = splitName(input.adminName);
  const joiningYear = new Date().getUTCFullYear();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.companyName,
        code: deriveCompanyCode(input.companyName),
        logoUrl: input.logoUrl,
      },
    });

    const serial = await allocateSerial(tx, company.id, joiningYear);
    const loginId = buildLoginId({
      companyCode: company.code,
      firstName,
      lastName,
      joiningYear,
      serial,
      serialWidth: company.serialWidth,
    });

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        loginId,
        email,
        phone: input.phone,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    await tx.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName,
        lastName,
        joinedOn: new Date(),
        joiningYear,
        joiningSerial: serial,
      },
    });

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

    const verifyToken = generateOpaqueToken();
    await tx.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(verifyToken),
        purpose: "VERIFY_EMAIL",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { company, user, verifyToken };
  });

  await writeAudit({
    companyId: result.company.id,
    actorId: result.user.id,
    action: "COMPANY_REGISTERED",
    entity: "Company",
    entityId: result.company.id,
    after: { name: result.company.name, code: result.company.code },
  });

  const verifyUrl = `${process.env.APP_URL}/verify?token=${result.verifyToken}`;
  const mail = await sendVerificationEmail(email, verifyUrl);

  return {
    companyId: result.company.id,
    userId: result.user.id,
    loginId: result.user.loginId,
    email,
    verifyUrl,
    emailPreviewUrl: mail.previewUrl,
  };
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.emailToken.findUnique({ where: { tokenHash } });

  if (!record || record.purpose !== "VERIFY_EMAIL") {
    throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid.");
  }
  if (record.usedAt) {
    throw new ApiError(409, "TOKEN_ALREADY_USED", "This verification link has already been used.");
  }
  if (record.expiresAt < new Date()) {
    throw new ApiError(410, "TOKEN_EXPIRED", "This verification link has expired.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  mustChangePassword: boolean;
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const normalized = identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ loginId: normalized.toUpperCase() }, { email: normalized.toLowerCase() }],
    },
    include: { employee: true },
  });

  // Compare against a dummy hash when the user doesn't exist so response timing
  // doesn't reveal whether the identifier is valid.
  const hashToCheck =
    user?.passwordHash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8fpe/8pMEP5nQwexPq9vwqu7ycKn.q";
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordOk) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect Login ID/email or password.");
  }
  if (user.role === Role.ADMIN && !user.emailVerifiedAt) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before signing in.");
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account has been suspended.");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
    employeeId: user.employee?.id ?? null,
    mustChangePassword: user.mustChangePassword,
  });

  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + parseDurationMs(process.env.REFRESH_TTL ?? "7d"));
  const familyId = generateOpaqueToken(16);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  await writeAudit({
    companyId: user.companyId,
    actorId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function refreshSession(refreshTokenRaw: string): Promise<LoginResult> {
  const tokenHash = hashToken(refreshTokenRaw);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please sign in again.");
  }

  if (record.revokedAt) {
    // Reuse of a revoked token — possible token theft. Kill the whole family.
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(
      401,
      "REFRESH_TOKEN_REUSED",
      "Session invalidated for your security. Please sign in again.",
    );
  }

  if (record.expiresAt < new Date()) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please sign in again.");
  }

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    include: { employee: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Session expired. Please sign in again.");
  }

  const newRefreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + parseDurationMs(process.env.REFRESH_TTL ?? "7d"));
  const newTokenHash = hashToken(newRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: record.familyId,
        tokenHash: newTokenHash,
        expiresAt: refreshExpiresAt,
      },
    }),
  ]);

  const accessToken = signAccessToken({
    sub: user.id,
    companyId: user.companyId,
    role: user.role,
    employeeId: user.employee?.id ?? null,
    mustChangePassword: user.mustChangePassword,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    refreshExpiresAt,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function logout(refreshTokenRaw: string | undefined): Promise<void> {
  if (!refreshTokenRaw) return;
  const tokenHash = hashToken(refreshTokenRaw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { employee: true },
  });

  return {
    user: {
      id: user.id,
      companyId: user.companyId,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    },
    employee: user.employee
      ? {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          avatarUrl: user.employee.avatarUrl,
        }
      : null,
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Current password is incorrect.",
      "currentPassword",
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  await writeAudit({
    companyId: user.companyId,
    actorId: user.id,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
  });
}

export async function forgotPassword(
  email: string,
): Promise<{ resetUrl?: string; emailPreviewUrl?: string }> {
  const normalized = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // Always behave the same whether or not the email exists, to avoid enumeration.
  if (!user) return {};

  const token = generateOpaqueToken();
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      purpose: "RESET_PASSWORD",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
  const mail = await sendPasswordResetEmail(normalized, resetUrl);

  return { resetUrl, emailPreviewUrl: mail.previewUrl };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.emailToken.findUnique({ where: { tokenHash } });

  if (!record || record.purpose !== "RESET_PASSWORD") {
    throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid.");
  }
  if (record.usedAt) {
    throw new ApiError(409, "TOKEN_ALREADY_USED", "This reset link has already been used.");
  }
  if (record.expiresAt < new Date()) {
    throw new ApiError(410, "TOKEN_EXPIRED", "This reset link has expired.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
